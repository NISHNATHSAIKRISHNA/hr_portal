// script.js
// frontend logic for HR portal
// keeping everything simple, using fetch() calls to backend api

let currentEmployee = null; // stores logged in employee data

// ---------------- LOGIN ----------------

function toggleLoginFields() {
    let role = document.getElementById('loginRole').value;
    let idLabel = document.getElementById('idLabel');
    if (role === 'admin') {
        idLabel.innerText = "Username:";
    } else {
        idLabel.innerText = "Employee ID:";
    }
}

function doLogin() {
    let role = document.getElementById('loginRole').value;
    let id = document.getElementById('loginId').value;
    let password = document.getElementById('loginPassword').value;

    fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: role, id: id, password: password })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            document.getElementById('loginError').innerText = "";
            document.getElementById('loginPage').classList.add('hidden');

            if (role === 'admin') {
                document.getElementById('adminPage').classList.remove('hidden');
                loadEmployees();
                loadAllAttendance();
                loadAllLeaves();
                loadAllSalaries();
                loadAllProgress();
            } else {
                currentEmployee = data.employee;
                document.getElementById('empPage').classList.remove('hidden');
                document.getElementById('empWelcome').innerText = "Welcome, " + currentEmployee.name;
                loadMyAttendance();
                loadMyLeaves();
                loadMySalary();
                loadMyProgress();
            }
        } else {
            document.getElementById('loginError').innerText = data.message;
        }
    });
}

function logout() {
    location.reload(); // simplest way to logout, just refresh page
}

// ---------------- TAB SWITCHING ----------------

function showAdminTab(tabId) {
    let tabs = document.querySelectorAll('#adminPage .tabContent');
    tabs.forEach(t => t.classList.add('hidden'));
    document.getElementById(tabId).classList.remove('hidden');
}

function showEmpTab(tabId) {
    let tabs = document.querySelectorAll('#empPage .tabContent');
    tabs.forEach(t => t.classList.add('hidden'));
    document.getElementById(tabId).classList.remove('hidden');
}

// ================= ADMIN FUNCTIONS =================

// load all employees into table + dropdown
function loadEmployees() {
    fetch('/api/employees')
    .then(res => res.json())
    .then(list => {
        let table = document.getElementById('empTable');
        // clear old rows except header
        table.innerHTML = "<tr><th>ID</th><th>Name</th><th>Email</th><th>Dept</th><th>Salary</th><th>Action</th></tr>";

        let select = document.getElementById('attEmpSelect');
        select.innerHTML = "";

        list.forEach(emp => {
            let row = table.insertRow();
            row.insertCell(0).innerText = emp.empId;
            row.insertCell(1).innerText = emp.name;
            row.insertCell(2).innerText = emp.email;
            row.insertCell(3).innerText = emp.department;
            row.insertCell(4).innerText = emp.salary;

            let actionCell = row.insertCell(5);
            let delBtn = document.createElement('button');
            delBtn.innerText = "Remove";
            delBtn.onclick = function() { removeEmployee(emp.empId); };
            actionCell.appendChild(delBtn);

            // add to attendance dropdown too
            let option = document.createElement('option');
            option.value = emp.empId;
            option.innerText = emp.empId + " - " + emp.name;
            select.appendChild(option);
        });
    });
}

function addEmployee() {
    let newEmp = {
        empId: document.getElementById('newEmpId').value,
        name: document.getElementById('newEmpName').value,
        email: document.getElementById('newEmpEmail').value,
        password: document.getElementById('newEmpPassword').value,
        department: document.getElementById('newEmpDept').value,
        salary: Number(document.getElementById('newEmpSalary').value),
        joined: new Date().toISOString().split('T')[0]
    };

    if (!newEmp.empId || !newEmp.name) {
        alert("please fill employee id and name");
        return;
    }

    fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEmp)
    })
    .then(res => res.json())
    .then(data => {
        alert(data.message);
        loadEmployees();
    });
}

function removeEmployee(empId) {
    if (!confirm("Remove employee " + empId + " ?")) return;

    fetch('/api/employees/' + empId, { method: 'DELETE' })
    .then(res => res.json())
    .then(data => {
        alert(data.message);
        loadEmployees();
        loadAllAttendance();
        loadAllSalaries();
    });
}

// attendance - admin marking manually
function markAttendanceAdmin() {
    let record = {
        empId: document.getElementById('attEmpSelect').value,
        date: document.getElementById('attDate').value,
        status: document.getElementById('attStatus').value,
        mode: "Manual",
        time: "-"
    };

    if (!record.empId || !record.date) {
        alert("select employee and date");
        return;
    }

    fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
    })
    .then(res => res.json())
    .then(data => {
        alert(data.message);
        loadAllAttendance();
        loadAllSalaries();
    });
}

function loadAllAttendance() {
    fetch('/api/attendance')
    .then(res => res.json())
    .then(list => {
        let table = document.getElementById('attTable');
        table.innerHTML = "<tr><th>Emp ID</th><th>Date</th><th>Status</th><th>Mode</th><th>Time</th></tr>";

        list.forEach(rec => {
            let row = table.insertRow();
            row.insertCell(0).innerText = rec.empId;
            row.insertCell(1).innerText = rec.date;
            row.insertCell(2).innerText = rec.status;
            row.insertCell(3).innerText = rec.mode;
            row.insertCell(4).innerText = rec.time;
        });
    });
}

// leave requests - admin view + approve/reject
function loadAllLeaves() {
    fetch('/api/leaves')
    .then(res => res.json())
    .then(list => {
        let table = document.getElementById('leaveTable');
        table.innerHTML = "<tr><th>ID</th><th>Emp</th><th>From</th><th>To</th><th>Reason</th><th>Status</th><th>Action</th></tr>";

        list.forEach(lv => {
            let row = table.insertRow();
            row.insertCell(0).innerText = lv.leaveId;
            row.insertCell(1).innerText = lv.empId;
            row.insertCell(2).innerText = lv.fromDate;
            row.insertCell(3).innerText = lv.toDate;
            row.insertCell(4).innerText = lv.reason;
            row.insertCell(5).innerText = lv.status;

            let actionCell = row.insertCell(6);

            if (lv.status === "Pending") {
                let approveBtn = document.createElement('button');
                approveBtn.innerText = "Approve";
                approveBtn.onclick = function() { updateLeaveStatus(lv.leaveId, "Approved"); };

                let rejectBtn = document.createElement('button');
                rejectBtn.innerText = "Reject";
                rejectBtn.onclick = function() { updateLeaveStatus(lv.leaveId, "Rejected"); };

                actionCell.appendChild(approveBtn);
                actionCell.appendChild(rejectBtn);
            } else {
                actionCell.innerText = "-- done --";
            }
        });
    });
}

function updateLeaveStatus(leaveId, status) {
    fetch('/api/leaves/' + leaveId, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: status })
    })
    .then(res => res.json())
    .then(data => {
        alert(data.message);
        loadAllLeaves();
    });
}

// salary - admin view of all employees paycheck
function loadAllSalaries() {
    fetch('/api/salary')
    .then(res => res.json())
    .then(list => {
        let table = document.getElementById('salaryTable');
        table.innerHTML = "<tr><th>Emp ID</th><th>Name</th><th>Base Salary</th><th>Absent Days</th><th>Deduction</th><th>Final Salary</th></tr>";

        list.forEach(s => {
            let row = table.insertRow();
            row.insertCell(0).innerText = s.empId;
            row.insertCell(1).innerText = s.name;
            row.insertCell(2).innerText = s.baseSalary;
            row.insertCell(3).innerText = s.absentDays;
            row.insertCell(4).innerText = s.deduction;
            row.insertCell(5).innerText = s.finalSalary;
        });
    });
}

// progress - admin view of everyone's work updates
function loadAllProgress() {
    fetch('/api/progress')
    .then(res => res.json())
    .then(list => {
        let table = document.getElementById('progTable');
        table.innerHTML = "<tr><th>Emp ID</th><th>Date</th><th>Update</th></tr>";

        list.forEach(p => {
            let row = table.insertRow();
            row.insertCell(0).innerText = p.empId;
            row.insertCell(1).innerText = p.date;
            row.insertCell(2).innerText = p.update;
        });
    });
}


// ================= EMPLOYEE FUNCTIONS =================

// simulate biometric punch in / punch out
function punchAttendance(status) {
    let now = new Date();
    let record = {
        empId: currentEmployee.empId,
        date: now.toISOString().split('T')[0],
        status: status,
        mode: "Biometric",
        time: now.toLocaleTimeString()
    };

    fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
    })
    .then(res => res.json())
    .then(data => {
        document.getElementById('punchMsg').innerText = "Marked " + status + " at " + record.time;
        loadMyAttendance();
    });
}

function loadMyAttendance() {
    fetch('/api/attendance?empId=' + currentEmployee.empId)
    .then(res => res.json())
    .then(list => {
        let table = document.getElementById('myAttTable');
        table.innerHTML = "<tr><th>Date</th><th>Status</th><th>Mode</th><th>Time</th></tr>";

        list.forEach(rec => {
            let row = table.insertRow();
            row.insertCell(0).innerText = rec.date;
            row.insertCell(1).innerText = rec.status;
            row.insertCell(2).innerText = rec.mode;
            row.insertCell(3).innerText = rec.time;
        });
    });
}

function applyLeave() {
    let leave = {
        empId: currentEmployee.empId,
        fromDate: document.getElementById('leaveFrom').value,
        toDate: document.getElementById('leaveTo').value,
        reason: document.getElementById('leaveReason').value
    };

    if (!leave.fromDate || !leave.toDate || !leave.reason) {
        alert("fill all leave fields");
        return;
    }

    fetch('/api/leaves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leave)
    })
    .then(res => res.json())
    .then(data => {
        document.getElementById('leaveMsg').innerText = data.message;
        loadMyLeaves();
    });
}

function loadMyLeaves() {
    fetch('/api/leaves?empId=' + currentEmployee.empId)
    .then(res => res.json())
    .then(list => {
        let table = document.getElementById('myLeaveTable');
        table.innerHTML = "<tr><th>From</th><th>To</th><th>Reason</th><th>Status</th></tr>";

        list.forEach(lv => {
            let row = table.insertRow();
            row.insertCell(0).innerText = lv.fromDate;
            row.insertCell(1).innerText = lv.toDate;
            row.insertCell(2).innerText = lv.reason;
            row.insertCell(3).innerText = lv.status;
        });
    });
}

function loadMySalary() {
    fetch('/api/salary/' + currentEmployee.empId)
    .then(res => res.json())
    .then(s => {
        let box = document.getElementById('mySalaryBox');
        box.innerHTML =
            "<p>Base Salary: " + s.baseSalary + "</p>" +
            "<p>Absent Days: " + s.absentDays + "</p>" +
            "<p>Deduction: " + s.deduction + "</p>" +
            "<p><b>Final Salary: " + s.finalSalary + "</b></p>";
    });
}

function submitProgress() {
    let update = document.getElementById('progUpdate').value;
    if (!update) {
        alert("write something about your work");
        return;
    }

    let record = {
        empId: currentEmployee.empId,
        date: new Date().toISOString().split('T')[0],
        update: update
    };

    fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
    })
    .then(res => res.json())
    .then(data => {
        document.getElementById('progMsg').innerText = data.message;
        document.getElementById('progUpdate').value = "";
        loadMyProgress();
    });
}

function loadMyProgress() {
    fetch('/api/progress?empId=' + currentEmployee.empId)
    .then(res => res.json())
    .then(list => {
        let table = document.getElementById('myProgTable');
        table.innerHTML = "<tr><th>Date</th><th>Update</th></tr>";

        list.forEach(p => {
            let row = table.insertRow();
            row.insertCell(0).innerText = p.date;
            row.insertCell(1).innerText = p.update;
        });
    });
}
