// js/analytics.js
// Description: Handles all logic for the Analytics tab, including KPIs and charts.

import { allProjects, allRequests, allClients } from './state.js';

// This object holds the actual Chart.js instances.
let charts = {
    revenue: null,
    services: null,
    projects: null
};

export function renderAnalytics() {
    // Destroy previous charts to prevent memory leaks and redraw issues
    Object.keys(charts).forEach(key => {
        if (charts[key]) {
            charts[key].destroy();
            charts[key] = null; // Ensure it's cleared
        }
    });

    // General check - if no data at all, show a message.
    if (!allProjects?.rows && !allRequests?.rows && !allClients?.rows) {
        document.getElementById('tab-analytics').innerHTML = '<h2>Analytics</h2><p>No data available to display analytics. Please check your data sources.</p>';
        return;
    }

    renderKpis();
    renderRevenueChart();
    renderServicesChart();
    renderProjectsChart();
    renderActivityFeed();
}

function renderKpis() {
    const currentYear = new Date().getFullYear();

    // KPI 1: Total Revenue (YTD)
    if (allProjects?.rows) {
        const [valIdx, dateIdx] = ['Value', 'Start Date'].map(h => allProjects.headers.indexOf(h));
        let ytdIncome = 0;
        if (valIdx > -1 && dateIdx > -1) {
            allProjects.rows.forEach(row => {
                if (row[dateIdx] && new Date(row[dateIdx]).getFullYear() === currentYear) {
                    ytdIncome += parseFloat(row[valIdx]) || 0;
                }
            });
        }
        document.getElementById('kpi-total-revenue').textContent = `$${ytdIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    // KPI 2: Active Projects
    if (allProjects?.rows) {
        const statusIdxProj = allProjects.headers.indexOf('Status');
        const inactiveStatuses = ['Completed', 'Cancelled', 'Archived'];
        let activeProjects = 0;
        if (statusIdxProj > -1) {
            activeProjects = allProjects.rows.filter(row => !inactiveStatuses.includes(row[statusIdxProj])).length;
        }
        document.getElementById('kpi-active-projects').textContent = activeProjects;
    }

    // KPI 3: Total Clients
    if (allClients?.rows) {
        document.getElementById('kpi-total-clients').textContent = allClients.rows.length;
    }


    // KPI 4: Pending Requests
    if (allRequests?.rows) {
        const statusIdxReq = allRequests.headers.indexOf('Status');
        let pendingRequests = 0;
        if (statusIdxReq > -1) {
            pendingRequests = allRequests.rows.filter(row => (row[statusIdxReq] || 'New') === 'New' || row[statusIdxReq] === 'Contacted').length;
        }
        document.getElementById('kpi-pending-requests').textContent = pendingRequests;
    }
}

function renderRevenueChart() {
    const canvas = document.getElementById('revenue-chart');
    if (!canvas || !allProjects?.rows) return; // Guard clause

    const revenueData = {};
    const [valIdx, dateIdx] = ['Value', 'Start Date'].map(h => allProjects.headers.indexOf(h));

    if (valIdx === -1 || dateIdx === -1) return;

    allProjects.rows.forEach(row => {
        const dateStr = row[dateIdx];
        const value = parseFloat(row[valIdx]) || 0;
        if (dateStr && value > 0) {
            try {
                const date = new Date(dateStr);
                const month = date.toLocaleString('default', { month: 'short', year: '2-digit' });
                if (revenueData[month]) {
                    revenueData[month] += value;
                } else {
                    revenueData[month] = value;
                }
            } catch(e) { /* ignore invalid dates */ }
        }
    });
    
    // Sort data by date
    const sortedKeys = Object.keys(revenueData).sort((a, b) => {
        const [monthA, yearA] = a.split(' ');
        const [monthB, yearB] = b.split(' ');
        const dateA = new Date(`01 ${monthA} 20${yearA}`);
        const dateB = new Date(`01 ${monthB} 20${yearB}`);
        return dateA - dateB;
    });

    const labels = sortedKeys;
    const dataPoints = sortedKeys.map(key => revenueData[key]);

    const ctx = canvas.getContext('2d');
    charts.revenue = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Revenue',
                data: dataPoints,
                backgroundColor: 'rgba(255, 157, 118, 0.2)',
                borderColor: 'rgba(255, 157, 118, 1)',
                borderWidth: 2,
                tension: 0.3,
                fill: true,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function renderServicesChart() {
    const canvas = document.getElementById('services-chart');
    if (!canvas || !allRequests?.rows) return; // Guard clause

    const servicesCount = {};
    const serviceIdx = allRequests.headers.indexOf('Primary Service Category');
    if (serviceIdx === -1) return;
    
    allRequests.rows.forEach(row => {
        const service = row[serviceIdx] || 'Uncategorized';
        servicesCount[service] = (servicesCount[service] || 0) + 1;
    });

    const labels = Object.keys(servicesCount);
    const dataPoints = Object.values(servicesCount);
    
    const backgroundColors = [
        '#FF9D76', '#76F1FF', '#C176FF', '#FFE176', '#8BFF76', '#FF76B7'
    ];

    const ctx = canvas.getContext('2d');
    charts.services = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: 'Service Requests',
                data: dataPoints,
                backgroundColor: backgroundColors,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
        }
    });
}

function renderProjectsChart() {
    const canvas = document.getElementById('projects-chart');
    if (!canvas || !allProjects?.rows) return; // Guard clause

    const statusCount = {};
    const statusIdx = allProjects.headers.indexOf('Status');
    if (statusIdx === -1) return;
    
    allProjects.rows.forEach(row => {
        const status = row[statusIdx] || 'Not Started';
        statusCount[status] = (statusCount[status] || 0) + 1;
    });

    const labels = Object.keys(statusCount);
    const dataPoints = Object.values(statusCount);

    const ctx = canvas.getContext('2d');
    charts.projects = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Number of Projects',
                data: dataPoints,
                backgroundColor: '#76F1FF',
                borderColor: '#59B6C2',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}


function renderActivityFeed() {
    const activityFeed = document.getElementById('activity-feed');
    if (!activityFeed) return;
    activityFeed.innerHTML = '';
    let combinedActivity = [];

    // New Requests
    if (allRequests?.rows) {
        const [subDateIdx, nameIdx, serviceIdx] = ['Submission Date', 'Full Name', 'Primary Service Category'].map(h => allRequests.headers.indexOf(h));
        if (subDateIdx > -1 && nameIdx > -1 && serviceIdx > -1) {
            allRequests.rows.forEach(row => {
                const date = new Date(row[subDateIdx]);
                if (!isNaN(date.getTime())) {
                    combinedActivity.push({
                        date: date,
                        text: `New request from <strong>${row[nameIdx]}</strong> for <em>${row[serviceIdx]}</em>.`
                    });
                }
            });
        }
    }

    // New Projects
    if (allProjects?.rows) {
        const [projNameIdx, projDateIdx] = ['Project Name', 'Start Date'].map(h => allProjects.headers.indexOf(h));
        if(projNameIdx > -1 && projDateIdx > -1) {
            allProjects.rows.forEach(row => {
                const date = new Date(row[projDateIdx]);
                if (!isNaN(date.getTime())) {
                     combinedActivity.push({
                        date: date,
                        text: `Project started: <strong>${row[projNameIdx]}</strong>.`
                    });
                }
            });
        }
    }
    
    // Sort by most recent
    combinedActivity.sort((a, b) => b.date - a.date);
    
    // Display top 15
    const recentActivities = combinedActivity.slice(0, 15);
    if (recentActivities.length === 0) {
        activityFeed.innerHTML = '<li>No recent activity found.</li>';
        return;
    }

    recentActivities.forEach(activity => {
        const li = document.createElement('li');
        li.innerHTML = `${activity.text} <span class="activity-date">${activity.date.toLocaleDateString()}</span>`;
        activityFeed.appendChild(li);
    });
}

