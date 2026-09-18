pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
        skipDefaultCheckout(true)
    }

    environment {
        COMPOSE_PROJECT_NAME = 'ecommerce-platform'
    }

    stages {

        stage('Checkout') {
            steps {
                echo '========================================='
                echo 'Cleaning Jenkins workspace'
                echo '========================================='

                deleteDir()

                echo 'Checking out source code...'
                checkout scm

                echo 'Source checkout completed'
            }
        }

        stage('Validate Project') {
            steps {
                sh '''
                    echo "========================================="
                    echo "Validating E-Commerce project"
                    echo "========================================="

                    test -f docker-compose.yml
                    test -d backend
                    test -d frontend

                    echo "Checking Prometheus configuration..."
                    test -f monitoring/prometheus/prometheus.yml

                    echo "Prometheus configuration file:"
                    ls -l monitoring/prometheus/prometheus.yml

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
                            echo "Building Prometheus image..."
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

        stage('Docker Deployment') {
            steps {
                sh '''
                    echo "========================================="
                    echo "Deploying E-Commerce platform"
                    echo "========================================="

                    docker compose up -d --remove-orphans

                    echo ""
                    echo "Docker Compose deployment completed"
                    echo ""

                    docker compose ps
                '''
            }
        }

        stage('Service Verification') {
            steps {
                sh '''
                    echo "========================================="
                    echo "Verifying Docker services"
                    echo "========================================="

                    services="backend mysql redis kafka kafka-connect nginx prometheus grafana cadvisor"

                    FAILED=0

                    printf "%-20s %-15s %-15s\\n" "SERVICE" "STATE" "HEALTH"
                    printf "%-20s %-15s %-15s\\n" "--------------------" "---------------" "---------------"

                    for service in $services
                    do
                        container=$(docker compose ps -q "$service")

                        if [ -z "$container" ]; then
                            printf "%-20s %-15s %-15s\\n" "$service" "MISSING" "FAILED"
                            FAILED=1
                            continue
                        fi

                        state=$(docker inspect \
                            --format '{{.State.Status}}' \
                            "$container" 2>/dev/null || echo "unknown")

                        health=$(docker inspect \
                            --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' \
                            "$container" 2>/dev/null || echo "unknown")

                        if [ "$state" != "running" ]; then
                            status="FAILED"
                            FAILED=1

                        elif [ "$health" = "unhealthy" ]; then
                            status="FAILED"
                            FAILED=1

                        elif [ "$health" = "starting" ]; then
                            status="STARTING"
                            FAILED=1

                        elif [ "$health" = "healthy" ]; then
                            status="HEALTHY"

                        elif [ "$health" = "no-healthcheck" ]; then
                            status="RUNNING"

                        else
                            status="FAILED"
                            FAILED=1
                        fi

                        printf "%-20s %-15s %-15s\\n" \
                            "$service" "$state" "$status"
                    done

                    echo ""

                    if [ "$FAILED" -ne 0 ]; then
                        echo "One or more Docker services failed verification."
                        docker compose ps
                        exit 1
                    fi

                    echo "All Docker services passed verification."
                '''
            }
        }

        stage('Generate Architecture Dashboard') {
            steps {
                sh '''
                    echo "========================================="
                    echo "Generating Architecture Dashboard"
                    echo "========================================="

                    mkdir -p dashboard

                    python3 <<'PYTHON'
import subprocess
from datetime import datetime

services = [
    ("backend", "Node.js / Express", "Application"),
    ("mysql", "MySQL 8.4", "Database"),
    ("redis", "Redis 7", "Caching"),
    ("kafka", "Apache Kafka", "Messaging"),
    ("kafka-connect", "Kafka Connect / Debezium", "Data Integration"),
    ("nginx", "Nginx", "Web / Reverse Proxy"),
    ("prometheus", "Prometheus", "Monitoring"),
    ("grafana", "Grafana", "Observability"),
    ("cadvisor", "cAdvisor", "Container Monitoring"),
]

def get_service_status(service):
    try:
        container = subprocess.check_output(
            ["docker", "compose", "ps", "-q", service],
            text=True
        ).strip()

        if not container:
            return "FAILED", "MISSING"

        state = subprocess.check_output(
            ["docker", "inspect", "--format", "{{.State.Status}}", container],
            text=True
        ).strip()

        health = subprocess.check_output(
            [
                "docker",
                "inspect",
                "--format",
                "{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}",
                container
            ],
            text=True
        ).strip()

        if state != "running":
            return "FAILED", state.upper()

        if health == "healthy":
            return "HEALTHY", "healthy"

        if health == "starting":
            return "STARTING", "starting"

        if health == "unhealthy":
            return "FAILED", "unhealthy"

        if health == "no-healthcheck":
            return "RUNNING", "no healthcheck"

        return "FAILED", health

    except Exception as e:
        return "FAILED", str(e)

rows = []

for service, technology, layer in services:
    status, detail = get_service_status(service)

    if status == "HEALTHY":
        css = "healthy"
    elif status == "RUNNING":
        css = "running"
    elif status == "STARTING":
        css = "starting"
    else:
        css = "failed"

    rows.append(f"""
        <div class="service {css}">
            <div class="service-name">{service}</div>
            <div class="technology">{technology}</div>
            <div class="layer">{layer}</div>
            <div class="status">{status}</div>
            <div class="detail">{detail}</div>
        </div>
    """)

generated = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>E-Commerce CI/CD Architecture</title>

<style>
body {{
    margin: 0;
    font-family: Arial, Helvetica, sans-serif;
    background: #111827;
    color: #f9fafb;
}}

.header {{
    padding: 30px;
    background: #1f2937;
    border-bottom: 1px solid #374151;
}}

.header h1 {{
    margin: 0 0 8px 0;
    font-size: 28px;
}}

.header p {{
    margin: 4px 0;
    color: #9ca3af;
}}

.pipeline {{
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 15px;
    padding: 25px;
    background: #0f172a;
    flex-wrap: wrap;
}}

.pipeline-box {{
    padding: 14px 22px;
    border-radius: 8px;
    background: #374151;
    border: 1px solid #4b5563;
    font-weight: bold;
}}

.arrow {{
    color: #9ca3af;
    font-size: 24px;
}}

.architecture {{
    padding: 30px;
}}

.layer {{
    color: #9ca3af;
    font-size: 13px;
}}

.services {{
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 18px;
    margin-top: 20px;
}}

.service {{
    padding: 20px;
    border-radius: 10px;
    background: #1f2937;
    border: 2px solid #374151;
}}

.service.healthy {{
    border-color: #22c55e;
}}

.service.running {{
    border-color: #3b82f6;
}}

.service.starting {{
    border-color: #eab308;
}}

.service.failed {{
    border-color: #ef4444;
}}

.service-name {{
    font-size: 19px;
    font-weight: bold;
    margin-bottom: 8px;
}}

.technology {{
    color: #d1d5db;
    margin-bottom: 8px;
}}

.status {{
    display: inline-block;
    margin-top: 12px;
    padding: 5px 10px;
    border-radius: 5px;
    background: #374151;
    font-size: 12px;
    font-weight: bold;
}}

.detail {{
    margin-top: 8px;
    color: #9ca3af;
    font-size: 12px;
}}

.footer {{
    padding: 20px 30px;
    color: #6b7280;
    border-top: 1px solid #374151;
}}
</style>
</head>

<body>

<div class="header">
    <h1>E-Commerce CI/CD Architecture</h1>
    <p>Jenkins Build: #{env.BUILD_NUMBER}</p>
    <p>Generated: {generated}</p>
</div>

<div class="pipeline">
    <div class="pipeline-box">Git</div>
    <div class="arrow">→</div>
    <div class="pipeline-box">Jenkins CI</div>
    <div class="arrow">→</div>
    <div class="pipeline-box">Docker Build</div>
    <div class="arrow">→</div>
    <div class="pipeline-box">Docker Deploy</div>
    <div class="arrow">→</div>
    <div class="pipeline-box">Service Verification</div>
</div>

<div class="architecture">

    <h2>Application Architecture</h2>

    <div class="services">

        <div class="service running">
            <div class="service-name">Frontend</div>
            <div class="technology">React</div>
            <div class="layer">Application Source</div>
            <div class="status">SOURCE</div>
            <div class="detail">Frontend application directory</div>
        </div>

        {''.join(rows)}

    </div>

</div>

<div class="footer">
    E-Commerce DevOps Learning Project • Jenkins CI/CD
</div>

</body>
</html>
"""

with open("dashboard/index.html", "w") as f:
    f.write(html)

print("Architecture dashboard generated successfully.")
PYTHON

                    echo "Dashboard generated:"
                    ls -lh dashboard/index.html
                '''
            }
        }
    }

    post {

        success {
            echo '========================================='
            echo 'E-Commerce CI/CD pipeline completed successfully'
            echo '========================================='
        }

        failure {
            echo '========================================='
            echo 'E-Commerce CI/CD pipeline failed'
            echo '========================================='
        }

        always {
            echo '========================================='
            echo 'Pipeline Summary'
            echo '========================================='

            sh '''
                echo "Docker Compose service summary:"

                docker compose ps --format "{{.Service}}|{{.State}}|{{.Health}}" || true
            '''

            script {
                def dashboardExists = fileExists('dashboard/index.html')

                if (dashboardExists) {
                    publishHTML(target: [
                        allowMissing: true,
                        alwaysLinkToLastBuild: true,
                        keepAll: true,
                        reportDir: 'dashboard',
                        reportFiles: 'index.html',
                        reportName: 'E-Commerce Architecture Dashboard'
                    ])

                    archiveArtifacts(
                        artifacts: 'dashboard/index.html',
                        allowEmptyArchive: true
                    )
                } else {
                    echo 'Architecture dashboard was not generated because an earlier pipeline stage failed.'
                }
            }

            echo 'Docker CI/CD pipeline finished'
        }
    }
}
