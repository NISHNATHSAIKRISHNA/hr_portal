// server.js
// simple HR portal backend
// made using plain node.js (http + fs) , no express used because keeping it simple

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

// hardcoded admin login (student project so keeping it simple, not secure)
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "admin123";

// ---------- helper functions ----------

// read data from json file
function readData() {
    let raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
}

// write data back to json file
function writeData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// send json response
function sendJSON(res, statusCode, obj) {
    res.writeHead(statusCode, { "Content-Type": "application/json" });
    res.end(JSON.stringify(obj));
}

// get content type based on file extension (for serving frontend files)
function getContentType(filePath) {
    let ext = path.extname(filePath);
    if (ext === '.html') return 'text/html';
    if (ext === '.css') return 'text/css';
    if (ext === '.js') return 'text/javascript';
    return 'text/plain';
}

// function to calculate salary/paycheck of employee based on absents
function calculateSalary(emp, data) {
    let allRecords = data.attendance.filter(a => a.empId === emp.empId);
    let absentCount = allRecords.filter(a => a.status === "Absent").length;

    let perDaySalary = emp.salary / 30; // assuming 30 days month
    let deduction = perDaySalary * absentCount;
    let finalSalary = emp.salary - deduction;

    return {
        empId: emp.empId,
        name: emp.name,
        baseSalary: emp.salary,
        absentDays: absentCount,
        deduction: Math.round(deduction),
        finalSalary: Math.round(finalSalary)
    };
}

// ---------- server ----------

const server = http.createServer((req, res) => {

    let parsedUrl = url.parse(req.url, true);
    let pathname = parsedUrl.pathname;

    // ================= SERVE FRONTEND FILES =================
    if (req.method === 'GET' && !pathname.startsWith('/api/')) {

        let filePath;
        if (pathname === '/') {
            filePath = path.join(__dirname, 'public', 'index.html');
        } else {
            filePath = path.join(__dirname, 'public', pathname);
        }

        fs.readFile(filePath, (err, content) => {
            if (err) {
                res.writeHead(404);
                res.end("page not found");
            } else {
                res.writeHead(200, { "Content-Type": getContentType(filePath) });
                res.end(content);
            }
        });
        return;
    }

    // ================= API ROUTES =================

    // collect POST body data first (if any)
    let body = '';
    req.on('data', chunk => { body += chunk; });

    req.on('end', () => {

        let parsedBody = {};
        if (body) {
            try {
                parsedBody = JSON.parse(body);
            } catch (e) {
                parsedBody = {};
            }
        }

        let data = readData();

        // ---------- LOGIN ----------
        if (pathname === '/api/login' && req.method === 'POST') {

            let { role, id, password } = parsedBody;

            if (role === 'admin') {
                if (id === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
                    sendJSON(res, 200, { success: true, role: 'admin' });
                } else {
                    sendJSON(res, 401, { success: false, message: "wrong admin credentials" });
                }
                return;
            }

            if (role === 'employee') {
                let emp = data.employees.find(e => e.empId === id && e.password === password);
                if (emp) {
                    sendJSON(res, 200, { success: true, role: 'employee', employee: emp });
                } else {
                    sendJSON(res, 401, { success: false, message: "wrong employee id or password" });
                }
                return;
            }

            sendJSON(res, 400, { success: false, message: "invalid role" });
            return;
        }

        // ---------- GET ALL EMPLOYEES ----------
        if (pathname === '/api/employees' && req.method === 'GET') {
            sendJSON(res, 200, data.employees);
            return;
        }

        // ---------- ADD NEW EMPLOYEE ----------
        if (pathname === '/api/employees' && req.method === 'POST') {
            let newEmp = parsedBody;

            // check if empId already used
            let already = data.employees.find(e => e.empId === newEmp.empId);
            if (already) {
                sendJSON(res, 400, { success: false, message: "employee id already exists" });
                return;
            }

            data.employees.push(newEmp);
            writeData(data);
            sendJSON(res, 200, { success: true, message: "employee added" });
            return;
        }

        // ---------- REMOVE EMPLOYEE ----------
        if (pathname.startsWith('/api/employees/') && req.method === 'DELETE') {
            let empId = pathname.split('/')[3];

            data.employees = data.employees.filter(e => e.empId !== empId);
            // also remove their attendance/leave/progress records
            data.attendance = data.attendance.filter(a => a.empId !== empId);
            data.leaves = data.leaves.filter(l => l.empId !== empId);
            data.progress = data.progress.filter(p => p.empId !== empId);

            writeData(data);
            sendJSON(res, 200, { success: true, message: "employee removed" });
            return;
        }

        // ---------- GET ATTENDANCE (all or by empId) ----------
        if (pathname === '/api/attendance' && req.method === 'GET') {
            let empId = parsedUrl.query.empId;
            if (empId) {
                let records = data.attendance.filter(a => a.empId === empId);
                sendJSON(res, 200, records);
            } else {
                sendJSON(res, 200, data.attendance);
            }
            return;
        }

        // ---------- MARK ATTENDANCE (manual by admin OR biometric punch by employee) ----------
        if (pathname === '/api/attendance' && req.method === 'POST') {
            let record = parsedBody; // { empId, date, status, mode, time }

            // remove old record for same emp+date if exists (so we dont duplicate)
            data.attendance = data.attendance.filter(a => !(a.empId === record.empId && a.date === record.date));

            data.attendance.push(record);
            writeData(data);
            sendJSON(res, 200, { success: true, message: "attendance marked" });
            return;
        }

        // ---------- GET LEAVES ----------
        if (pathname === '/api/leaves' && req.method === 'GET') {
            let empId = parsedUrl.query.empId;
            if (empId) {
                sendJSON(res, 200, data.leaves.filter(l => l.empId === empId));
            } else {
                sendJSON(res, 200, data.leaves);
            }
            return;
        }

        // ---------- APPLY LEAVE (employee) ----------
        if (pathname === '/api/leaves' && req.method === 'POST') {
            let newLeave = parsedBody;

            // generate simple leave id
            let maxId = 0;
            data.leaves.forEach(l => { if (l.leaveId > maxId) maxId = l.leaveId; });
            newLeave.leaveId = maxId + 1;
            newLeave.status = "Pending";

            data.leaves.push(newLeave);
            writeData(data);
            sendJSON(res, 200, { success: true, message: "leave application submitted" });
            return;
        }

        // ---------- APPROVE / REJECT LEAVE (admin) ----------
        if (pathname.startsWith('/api/leaves/') && req.method === 'POST') {
            let leaveId = parseInt(pathname.split('/')[3]);
            let newStatus = parsedBody.status; // "Approved" or "Rejected"

            let leave = data.leaves.find(l => l.leaveId === leaveId);
            if (leave) {
                leave.status = newStatus;
                writeData(data);
                sendJSON(res, 200, { success: true, message: "leave status updated" });
            } else {
                sendJSON(res, 404, { success: false, message: "leave not found" });
            }
            return;
        }

        // ---------- GET PROGRESS UPDATES ----------
        if (pathname === '/api/progress' && req.method === 'GET') {
            let empId = parsedUrl.query.empId;
            if (empId) {
                sendJSON(res, 200, data.progress.filter(p => p.empId === empId));
            } else {
                sendJSON(res, 200, data.progress);
            }
            return;
        }

        // ---------- SUBMIT PROGRESS UPDATE (employee) ----------
        if (pathname === '/api/progress' && req.method === 'POST') {
            data.progress.push(parsedBody);
            writeData(data);
            sendJSON(res, 200, { success: true, message: "progress update submitted" });
            return;
        }

        // ---------- GET SALARY / PAYCHECK ----------
        if (pathname.startsWith('/api/salary/') && req.method === 'GET') {
            let empId = pathname.split('/')[3];
            let emp = data.employees.find(e => e.empId === empId);

            if (!emp) {
                sendJSON(res, 404, { success: false, message: "employee not found" });
                return;
            }

            let salaryInfo = calculateSalary(emp, data);
            sendJSON(res, 200, salaryInfo);
            return;
        }

        // ---------- GET SALARY OF ALL EMPLOYEES (for admin view) ----------
        if (pathname === '/api/salary' && req.method === 'GET') {
            let allSalaries = data.employees.map(emp => calculateSalary(emp, data));
            sendJSON(res, 200, allSalaries);
            return;
        }

        // ---------- IF NOTHING MATCHED ----------
        sendJSON(res, 404, { success: false, message: "api route not found" });
    });
});

server.listen(PORT, () => {
    console.log("HR portal server running on http://localhost:" + PORT);
});
