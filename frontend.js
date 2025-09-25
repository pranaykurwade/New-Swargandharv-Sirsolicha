document.getElementById("registrationForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);

    try {
        const res = await fetch("http://localhost:5001/api/register", {
            method: "POST",
            body: formData
        });

        const data = await res.json();
        if (res.ok && data.success) {
            alert("✅ नोंदणी यशस्वी! Registration ID: " + data.data.registrationId);
            form.reset();
        } else {
            alert("❌ त्रुटी: " + (data.message || "Unknown server error"));
        }
    } catch (err) {
        console.error("Fetch error:", err);
        alert("⚠️ सर्व्हरशी कनेक्शन होत नाही — " + (err.message || "Network error"));
    }
});

document.getElementById("checkStatusBtn").addEventListener("click", async () => {
    const registrationId = document.getElementById("registrationId").value.trim();
    if (!registrationId) {
        alert("❌ कृपया नोंदणी आयडी टाका");
        return;
    }

    try {
        const res = await fetch(`http://localhost:5001/api/registration/${registrationId}`);
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.message || `Server error ${res.status}`);
        }
        const data = await res.json();
        if (data.success) {
            const resultDiv = document.getElementById("statusResult");
            resultDiv.innerHTML = `
                <div class="bg-green-100 p-4 rounded">
                    <p><strong>नोंदणी आयडी:</strong> ${data.data.registrationId}</p>
                    <p><strong>नाव:</strong> ${data.data.fullName}</p>
                    <p><strong>वय:</strong> ${data.data.age}</p>
                    <p><strong>फोन:</strong> ${data.data.phone}</p>
                    <p><strong>गाण्याचा प्रकार:</strong> ${data.data.songType}</p>
                    <p><strong>नोंदणी दिनांक:</strong> ${new Date(data.data.createdAt).toLocaleDateString()}</p>
                    <p><strong>स्थिती:</strong> ${data.data.status === 'pending' ? 'प्रलंबित' : data.data.status === 'approved' ? 'मंजूर' : 'नाकारले'}</p>
                </div>
            `;
        } else {
            alert("❌ " + data.message);
        }
    } catch (err) {
        alert("⚠️ सर्व्हरशी कनेक्शन होत नाही — " + (err.message || ""));
        console.error(err);
    }
});

document.getElementById("adminLoginBtn").addEventListener("click", () => {
    const password = prompt("Enter admin password:");
    if (password === "admin123") { // Replace with secure auth later
        document.querySelector(".admin-panel").classList.add("active");
        loadAdminData();
    } else {
        alert("Invalid password");
    }
});

async function loadAdminData() {
    try {
        const res = await fetch("http://localhost:5001/api/stats");
        const data = await res.json();
        if (data.success) {
            document.getElementById("totalRegistrations").textContent = data.data.totalRegistrations;
            data.data.byCategory.forEach(category => {
                if (category.category === 'बाल वर्ग') document.getElementById("childCategory").textContent = category.count;
                if (category.category === 'महिला वर्ग') document.getElementById("femaleCategory").textContent = category.count;
                if (category.category === 'पुरुष वर्ग') document.getElementById("maleCategory").textContent = category.count;
            });
        } else {
            alert("❌ " + data.message);
        }
    } catch (err) {
        console.error("Admin stats error:", err);
        alert("⚠️ सर्व्हरशी कनेक्शन होत नाही");
    }

    try {
        const res = await fetch("http://localhost:5001/api/registrations");
        const data = await res.json();
        if (data.success) {
            const tableBody = document.querySelector("#registrationsTable tbody");
            tableBody.innerHTML = "";
            data.data.forEach(reg => {
                const row = document.createElement("tr");
                row.innerHTML = `
                    <td>${reg.registrationId}</td>
                    <td>${reg.fullName}</td>
                    <td>${reg.age}</td>
                    <td>${reg.category}</td>
                    <td>${reg.songType}</td>
                    <td>${reg.status === 'pending' ? 'प्रलंबित' : reg.status === 'approved' ? 'मंजूर' : 'नाकारले'}</td>
                    <td><a href="${reg.paymentScreenshot?.url || '#'}" target="_blank">View</a></td>
                    <td>${new Date(reg.createdAt).toLocaleDateString()}</td>
                `;
                tableBody.appendChild(row);
            });
        }
    } catch (err) {
        console.error("Registrations fetch error:", err);
    }
}