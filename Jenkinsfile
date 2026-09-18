pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
    }

    environment {
        COMPOSE_PROJECT_NAME = 'ecommerce-platform'
    }

    stages {

        stage('Validate Project') {
            steps {
                sh '''
                    echo "========================================="
                    echo "Validating E-Commerce project"
                    echo "========================================="

                    test -f docker-compose.yml
                    test -d backend
                    test -d frontend

                    docker compose config --quiet

                    echo "Project validation passed"
                '''
            }
        }

        stage('Docker Services') {
            parallel {

                stage('Backend') {
                    steps {
                        sh '''
                            echo "Building backend Docker image..."
                            docker compose build backend
                        '''
                    }
                }

                stage('MySQL') {
                    steps {
                        sh '''
                            echo "Checking MySQL image..."
                            docker compose pull mysql
                        '''
                    }
                }

                stage('Redis') {
                    steps {
                        sh '''
                            echo "Checking Redis image..."
                            docker compose pull redis
                        '''
                    }
                }

                stage('Kafka') {
                    steps {
                        sh '''
                            echo "Checking Kafka image..."
                            docker compose pull kafka
                        '''
                    }
                }

                stage('Kafka Connect') {
                    steps {
                        sh '''
                            echo "Checking Kafka Connect image..."
                            docker compose pull kafka-connect
                        '''
                    }
                }

                stage('Nginx') {
                    steps {
                        sh '''
                            echo "Checking Nginx image..."
                            docker compose pull nginx
                        '''
                    }
                }

                stage('Prometheus') {
                    steps {
                        sh '''
                            echo "Checking Prometheus image..."
                            docker compose pull prometheus
                        '''
                    }
                }

                stage('Grafana') {
                    steps {
                        sh '''
                            echo "Checking Grafana image..."
                            docker compose pull grafana
                        '''
                    }
                }

                stage('cAdvisor') {
                    steps {
                        sh '''
                            echo "Checking cAdvisor image..."
                            docker compose pull cadvisor
                        '''
                    }
                }
            }
        }

        stage('Docker Compose Validation') {
            steps {
                sh '''
                    echo "========================================="
                    echo "Docker Compose validation"
                    echo "========================================="

                    docker compose config --quiet

                    echo "Docker Compose configuration is valid"
                '''
            }
        }

        stage('Docker Images') {
            steps {
                sh '''
                    echo "========================================="
                    echo "Docker images"
                    echo "========================================="

                    docker compose images
                '''
            }
        }

        /*
         * NEW:
         * Actually deploy the Compose application.
         */
        stage('Docker Deployment') {
            steps {
                sh '''
                    echo "========================================="
                    echo "Deploying E-Commerce application"
                    echo "========================================="

                    docker compose up -d --remove-orphans

                    echo ""
                    echo "Docker Compose deployment completed."
                    echo ""

                    docker compose ps
                '''
            }
        }

        /*
         * NEW:
         * Wait briefly for containers to initialize before checking
         * their actual state.
         */
        stage('Service Verification') {
            steps {
                sh '''
                    echo "========================================="
                    echo "Verifying Docker services"
                    echo "========================================="

                    echo "Waiting for services to initialize..."
                    sleep 15

                    echo ""
                    echo "Current Docker Compose status:"
                    docker compose ps

                    echo ""
                    echo "Checking required services..."
                '''

                script {
                    def services = [
                        'backend',
                        'mysql',
                        'redis',
                        'kafka',
                        'kafka-connect',
                        'nginx',
                        'prometheus',
                        'grafana',
                        'cadvisor'
                    ]

                    def failedServices = []

                    for (service in services) {

                        def containerId = sh(
                            script: "docker compose ps -q ${service}",
                            returnStdout: true
                        ).trim()

                        if (!containerId) {
                            echo "🔴 ${service}: FAILED - container does not exist"
                            failedServices.add(service)
                            continue
                        }

                        def state = sh(
                            script: "docker inspect -f '{{.State.Status}}' ${containerId}",
                            returnStdout: true
                        ).trim()

                        def health = sh(
                            script: """
                                docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' ${containerId}
                            """,
                            returnStdout: true
                        ).trim()

                        if (state != 'running') {
                            echo "🔴 ${service}: FAILED - state=${state}"
                            failedServices.add(service)
                        }
                        else if (health == 'healthy') {
                            echo "🟢 ${service}: HEALTHY"
                        }
                        else if (health == 'unhealthy') {
                            echo "🔴 ${service}: FAILED - health=unhealthy"
                            failedServices.add(service)
                        }
                        else if (health == 'starting') {
                            echo "🟡 ${service}: STARTING"
                            failedServices.add(service)
                        }
                        else {
                            echo "🟢 ${service}: RUNNING"
                        }
                    }

                    if (!failedServices.isEmpty()) {
                        error(
                            "Docker service verification failed: " +
                            failedServices.join(', ')
                        )
                    }

                    echo ""
                    echo "All required Docker services passed verification."
                }
            }
        }

        /*
         * NEW:
         * Generate a dashboard from the REAL Docker state.
         *
         * Important:
         * A service without a Docker healthcheck is shown as RUNNING,
         * not HEALTHY.
         */
        stage('Generate Architecture Dashboard') {
            steps {
                sh '''
                    set +e

                    mkdir -p dashboard

                    python3 <<'PYTHON'
import subprocess
from datetime import datetime
from html import escape

services = [
    ("frontend", "Frontend", "React"),
    ("nginx", "Nginx", "Reverse Proxy"),
    ("backend", "Backend", "Node / Express"),
    ("mysql", "MySQL", "Database"),
    ("redis", "Redis", "Cache"),
    ("kafka", "Kafka", "Event Streaming"),
    ("kafka-connect", "Kafka Connect", "Data Integration"),
    ("prometheus", "Prometheus", "Monitoring"),
    ("grafana", "Grafana", "Visualization"),
    ("cadvisor", "cAdvisor", "Container Metrics"),
]

def run(command):
    try:
        result = subprocess.run(
            command,
            shell=True,
            text=True,
            capture_output=True
        )
        return result.stdout.strip()
    except Exception:
        return ""

rows = []
healthy = 0
running = 0
failed = 0

for compose_name, display_name, role in services:

    container_id = run(
        f"docker compose ps -q {compose_name}"
    )

    if not container_id:
        status = "FAILED"
        icon = "🔴"
        css = "failed"
        state = "container missing"
        health = "-"
        failed += 1

    else:
        state = run(
            f"docker inspect -f '{{{{.State.Status}}}}' {container_id}"
        )

        health = run(
            f"docker inspect -f '{{{{if .State.Health}}}}{{{{.State.Health.Status}}}}{{{{else}}}}no-healthcheck{{{{end}}}}' {container_id}"
        )

        if state != "running":
            status = "FAILED"
            icon = "🔴"
            css = "failed"
            failed += 1

        elif health == "healthy":
            status = "HEALTHY"
            icon = "🟢"
            css = "healthy"
            healthy += 1

        elif health == "unhealthy":
            status = "FAILED"
            icon = "🔴"
            css = "failed"
            failed += 1

        elif health == "starting":
            status = "STARTING"
            icon = "🟡"
            css = "starting"
            failed += 1

        else:
            status = "RUNNING"
            icon = "🟢"
            css = "running"
            running += 1

    rows.append(f"""
        <tr>
            <td>{escape(display_name)}</td>
            <td>{escape(role)}</td>
            <td>{escape(state)}</td>
            <td>{escape(health)}</td>
            <td class="{css}">
                {icon} <strong>{escape(status)}</strong>
            </td>
        </tr>
    """)

total = len(services)

if failed == 0:
    overall_icon = "🟢"
    overall_status = "ALL SERVICES OPERATIONAL"
    overall_class = "overall-healthy"
else:
    overall_icon = "🔴"
    overall_status = "SERVICE VERIFICATION FAILED"
    overall_class = "overall-failed"

timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">

<title>E-Commerce CI/CD Dashboard</title>

<style>

body {{
    font-family: Arial, Helvetica, sans-serif;
    margin: 0;
    padding: 30px;
    background: #f4f6f8;
    color: #17202a;
}}

.container {{
    max-width: 1200px;
    margin: auto;
}}

.header {{
    background: #17202a;
    color: white;
    padding: 25px;
    border-radius: 12px;
    margin-bottom: 20px;
}}

.header h1 {{
    margin: 0 0 8px 0;
}}

.header p {{
    margin: 0;
    opacity: 0.8;
}}

.overall {{
    padding: 20px;
    border-radius: 10px;
    margin-bottom: 20px;
    font-size: 20px;
    font-weight: bold;
}}

.overall-healthy {{
    background: #d5f5e3;
    border: 1px solid #82e0aa;
}}

.overall-failed {{
    background: #fadbd8;
    border: 1px solid #ec7063;
}}

.architecture {{
    background: white;
    padding: 25px;
    border-radius: 12px;
    margin-bottom: 20px;
    text-align: center;
}}

.architecture .layer {{
    padding: 15px;
    margin: 10px auto;
    border: 1px solid #ccd1d1;
    border-radius: 8px;
    max-width: 900px;
}}

.architecture .arrow {{
    font-size: 24px;
    margin: 5px;
}}

.summary {{
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 15px;
    margin-bottom: 20px;
}}

.card {{
    background: white;
    padding: 20px;
    border-radius: 10px;
    text-align: center;
    border: 1px solid #e5e7e9;
}}

.card .number {{
    font-size: 30px;
    font-weight: bold;
}}

table {{
    width: 100%;
    border-collapse: collapse;
    background: white;
    border-radius: 12px;
    overflow: hidden;
}}

th {{
    background: #2c3e50;
    color: white;
    padding: 14px;
    text-align: left;
}}

td {{
    padding: 13px;
    border-bottom: 1px solid #eaeded;
}}

.healthy {{
    color: #196f3d;
}}

.running {{
    color: #196f3d;
}}

.failed {{
    color: #922b21;
}}

.starting {{
    color: #9a7d0a;
}}

.footer {{
    margin-top: 20px;
    color: #707b7c;
    font-size: 13px;
}}

@media (max-width: 800px) {{
    .summary {{
        grid-template-columns: repeat(2, 1fr);
    }}
}}

</style>
</head>

<body>

<div class="container">

<div class="header">
    <h1>🛒 E-Commerce CI/CD Dashboard</h1>
    <p>Docker Compose Architecture & Service Status</p>
    <p>Generated: {escape(timestamp)}</p>
</div>

<div class="overall {overall_class}">
    {overall_icon} {escape(overall_status)}
</div>

<div class="summary">

    <div class="card">
        <div>Total Services</div>
        <div class="number">{total}</div>
    </div>

    <div class="card">
        <div>Healthy</div>
        <div class="number">{healthy}</div>
    </div>

    <div class="card">
        <div>Running</div>
        <div class="number">{running}</div>
    </div>

    <div class="card">
        <div>Failed</div>
        <div class="number">{failed}</div>
    </div>

</div>

<div class="architecture">

    <h2>Application Architecture</h2>

    <div class="layer">
        🌐 <strong>Frontend</strong><br>
        React Application
    </div>

    <div class="arrow">↓</div>

    <div class="layer">
        🔀 <strong>Nginx</strong><br>
        Reverse Proxy
    </div>

    <div class="arrow">↓</div>

    <div class="layer">
        ⚙️ <strong>Backend</strong><br>
        Node.js / Express
    </div>

    <div class="arrow">↓</div>

    <div class="layer">
        🗄️ <strong>Data Layer</strong><br>
        MySQL + Redis
    </div>

    <div class="arrow">↓</div>

    <div class="layer">
        📨 <strong>Event Streaming</strong><br>
        Kafka + Kafka Connect
    </div>

    <div class="arrow">↓</div>

    <div class="layer">
        📊 <strong>Monitoring</strong><br>
        Prometheus + Grafana + cAdvisor
    </div>

</div>

<h2>Docker Service Status</h2>

<table>

<thead>
<tr>
    <th>Service</th>
    <th>Role</th>
    <th>Container State</th>
    <th>Docker Health</th>
    <th>Status</th>
</tr>
</thead>

<tbody>
{''.join(rows)}
</tbody>

</table>

<div class="footer">
    Jenkins CI/CD • Docker Compose • Service verification based on actual Docker container state
</div>

</div>

</body>
</html>
"""

with open("dashboard/index.html", "w", encoding="utf-8") as f:
    f.write(html)

print("Architecture dashboard generated successfully.")
PYTHON

                    echo ""
                    echo "Dashboard generated at:"
                    echo "dashboard/index.html"
                '''
            }
        }
    }

    post {

        always {

            script {

                /*
                 * Generate a short build-page summary.
                 *
                 * This keeps the normal Jenkins build page useful even
                 * before opening the full HTML dashboard.
                 */
                def statusOutput = sh(
                    script: '''
                        docker compose ps --format "{{.Service}}|{{.State}}|{{.Health}}" 2>/dev/null || true
                    ''',
                    returnStdout: true
                ).trim()

                def summaryLines = []

                if (statusOutput) {

                    statusOutput.split("\\n").each { line ->

                        def parts = line.split("\\|", -1)

                        if (parts.size() >= 3) {

                            def service = parts[0]
                            def state = parts[1]
                            def health = parts[2]

                            def icon

                            if (state != "running") {
                                icon = "🔴"
                            }
                            else if (health == "healthy") {
                                icon = "🟢"
                            }
                            else if (health == "unhealthy") {
                                icon = "🔴"
                            }
                            else if (health == "starting") {
                                icon = "🟡"
                            }
                            else {
                                icon = "🟢"
                            }

                            def displayStatus

                            if (state != "running") {
                                displayStatus = "FAILED"
                            }
                            else if (health == "healthy") {
                                displayStatus = "HEALTHY"
                            }
                            else if (health == "unhealthy") {
                                displayStatus = "FAILED"
                            }
                            else if (health == "starting") {
                                displayStatus = "STARTING"
                            }
                            else {
                                displayStatus = "RUNNING"
                            }

                            summaryLines.add(
                                "${icon} ${service}: ${displayStatus}"
                            )
                        }
                    }
                }

                def buildResult = currentBuild.currentResult ?: "UNKNOWN"

                currentBuild.description = """
                    <b>🛒 E-Commerce CI/CD</b><br/>
                    Build #${env.BUILD_NUMBER}<br/>
                    <b>Build Result:</b> ${buildResult}<br/>
                    <br/>
                    ${summaryLines.join("<br/>")}
                    <br/><br/>
                    <b>📊 Architecture Dashboard:</b>
                    See published HTML report below.
                """

                /*
                 * Publish the generated dashboard.
                 *
                 * Each build gets its own report, so Build #4, #5, #6...
                 * can each have their own architecture/status snapshot.
                 */
                publishHTML(
                    target: [
                        allowMissing: false,
                        alwaysLinkToLastBuild: false,
                        keepAll: true,
                        reportDir: 'dashboard',
                        reportFiles: 'index.html',
                        reportName: '🛒 E-Commerce Architecture Dashboard',
                        reportTitles: 'E-Commerce CI/CD Dashboard'
                    ]
                )
            }

            archiveArtifacts(
                artifacts: 'dashboard/index.html',
                allowEmptyArchive: false,
                fingerprint: true
            )

            echo '========================================='
            echo 'Docker CI/CD pipeline finished'
            echo '========================================='
        }

        success {
            echo '========================================='
            echo '🟢 E-Commerce CI/CD pipeline completed'
            echo 'successfully'
            echo '========================================='
        }

        failure {
            echo '========================================='
            echo '🔴 E-Commerce CI/CD pipeline failed'
            echo 'Check Docker service verification'
            echo 'and the Architecture Dashboard.'
            echo '========================================='
        }
    }
}
