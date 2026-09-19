pipeline {

    agent any

    environment {
        COMPOSE_PROJECT_NAME = 'ecommerce-platform'

        DB_HOST = 'mysql'
        DB_PORT = '3306'
        DB_USER = 'ecommerce_user'
        DB_NAME = 'ecommerce'

        DB_PASSWORD = credentials('ecommerce-db-password')
        MYSQL_ROOT_PASSWORD = credentials('ecommerce-mysql-root-password')
    }

    options {
        timestamps()
        disableConcurrentBuilds()
        skipDefaultCheckout(true)
    }

    stages {

        // ============================================================
        // CHECKOUT
        // ============================================================

        stage('Checkout') {
            steps {

                echo '========================================='
                echo 'Cleaning Jenkins workspace'
                echo '========================================='

                deleteDir()

                echo 'Checking out source code...'

                script {

                    def scmVars = checkout(scm)

                    env.DEPLOYED_GIT_COMMIT = scmVars.GIT_COMMIT ?: sh(
                        script: 'git rev-parse --short HEAD',
                        returnStdout: true
                    ).trim()

                    env.DEPLOYED_GIT_BRANCH = scmVars.GIT_BRANCH ?: ''

                    if (!env.DEPLOYED_GIT_BRANCH?.trim()) {
                        env.DEPLOYED_GIT_BRANCH = env.BRANCH_NAME ?: ''
                    }

                    if (!env.DEPLOYED_GIT_BRANCH?.trim()) {
                        env.DEPLOYED_GIT_BRANCH = 'unknown'
                    }

                    env.DEPLOYED_GIT_BRANCH = env.DEPLOYED_GIT_BRANCH
                        .replaceFirst(/^origin\//, '')
                        .trim()

                    echo "Checked out commit: ${env.DEPLOYED_GIT_COMMIT}"
                    echo "Checked out branch: ${env.DEPLOYED_GIT_BRANCH}"
                }

                echo 'Source checkout completed'
            }
        }


        // ============================================================
        // VALIDATE PROJECT
        // ============================================================

        stage('Validate Project') {
            steps {

                sh '''
                    set -e

                    echo "========================================="
                    echo "Validating E-Commerce project"
                    echo "========================================="

                    test -f docker-compose.yml

                    echo "docker-compose.yml found"

                    docker compose config -q

                    echo "Docker Compose configuration is valid"

                    echo ""
                    echo "Compose services:"
                    docker compose config --services

                    echo ""
                    echo "Project validation completed successfully"
                '''
            }
        }


        // ============================================================
        // DOCKER SERVICES
        // ============================================================

        stage('Docker Services') {

            parallel {

                // ----------------------------------------------------
                // BUILD APPLICATION IMAGES
                // ----------------------------------------------------

                stage('Build Application Images') {
                    steps {

                        sh '''
                            set -e

                            echo "========================================="
                            echo "Building application images"
                            echo "========================================="

                            docker compose build backend nginx

                            echo ""
                            echo "Application image build completed"
                        '''
                    }
                }


                // ----------------------------------------------------
                // PULL INFRASTRUCTURE IMAGES
                // ----------------------------------------------------

                stage('Pull Infrastructure Images') {
                    steps {

                        sh '''
                            set -e

                            echo "========================================="
                            echo "Pulling infrastructure images"
                            echo "========================================="

                            docker pull mysql:8.4
                            docker pull redis:7
                            docker pull prom/prometheus:v3.5.0
                            docker pull grafana/grafana:12.1.1
                            docker pull gcr.io/cadvisor/cadvisor:v0.52.1

                            echo ""
                            echo "Infrastructure images pulled successfully"
                        '''
                    }
                }
            }
        }


        // ============================================================
        // DOCKER COMPOSE VALIDATION
        // ============================================================

        stage('Docker Compose Validation') {
            steps {

                sh '''
                    set -e

                    echo "========================================="
                    echo "Validating Docker Compose"
                    echo "========================================="

                    docker compose config -q

                    echo "Docker Compose configuration validated successfully"
                '''
            }
        }


        // ============================================================
        // DOCKER IMAGES
        // ============================================================

        stage('Docker Images') {
            steps {

                sh '''
                    set -e

                    echo "========================================="
                    echo "Docker Images"
                    echo "========================================="

                    docker images --format "table {{.Repository}}\\t{{.Tag}}\\t{{.Size}}"

                    echo ""
                    echo "Docker image stage completed"
                '''
            }
        }


        // ============================================================
        // DOCKER DEPLOYMENT
        // ============================================================

        stage('Docker Deployment') {
            steps {

                sh '''
                    set -e

                    echo "========================================="
                    echo "Deploying E-Commerce Platform"
                    echo "========================================="

                    docker compose up -d

                    echo ""
                    echo "Docker Compose deployment started"

                    docker compose ps
                '''
            }
        }


        // ============================================================
        // SERVICE VERIFICATION
        // ============================================================

        stage('Service Verification') {
            steps {

                sh '''
                    set -e

                    echo "========================================="
                    echo "Verifying E-Commerce Services"
                    echo "========================================="

                    services="backend mysql redis kafka kafka-connect nginx prometheus grafana cadvisor"

                    max_attempts=24
                    attempt=1

                    while [ "$attempt" -le "$max_attempts" ]; do

                        failed=0
                        starting=0

                        echo ""
                        echo "Verification attempt $attempt/$max_attempts"
                        echo "-----------------------------------------"

                        for service in $services; do

                            container_id=$(docker compose ps -q "$service" 2>/dev/null || true)

                            if [ -z "$container_id" ]; then
                                echo "[$service] CONTAINER NOT FOUND"
                                failed=1
                                continue
                            fi

                            state=$(docker inspect -f '{{.State.Status}}' "$container_id" 2>/dev/null || echo "unknown")

                            health=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container_id" 2>/dev/null || echo "unknown")

                            if [ "$state" != "running" ]; then
                                echo "[$service] state=$state health=$health"
                                failed=1

                            elif [ "$health" = "starting" ]; then
                                echo "[$service] state=running health=starting"
                                starting=1

                            elif [ "$health" != "healthy" ] && [ "$health" != "none" ]; then
                                echo "[$service] state=running health=$health"
                                failed=1

                            else
                                echo "[$service] state=running health=$health"
                            fi

                        done

                        echo ""

                        if [ "$failed" -eq 0 ] && [ "$starting" -eq 0 ]; then
                            echo "========================================="
                            echo "All services verified successfully"
                            echo "========================================="
                            exit 0
                        fi

                        if [ "$failed" -eq 1 ] && [ "$starting" -eq 0 ]; then
                            echo "========================================="
                            echo "Service verification failed"
                            echo "========================================="
                            exit 1
                        fi

                        echo "Waiting for services to become healthy..."

                        sleep 5

                        attempt=$((attempt + 1))

                    done

                    echo "========================================="
                    echo "Service verification timed out"
                    echo "========================================="

                    exit 1
                '''
            }
        }


        // ============================================================
        // GENERATE ARCHITECTURE DASHBOARD
        // ============================================================

        stage('Generate Architecture Dashboard') {

            steps {

                sh '''
                    set -e

                    echo "========================================="
                    echo "Generating E-Commerce CI/CD Dashboard"
                    echo "========================================="

                    mkdir -p dashboard

                    generated="$(date '+%Y-%m-%d %H:%M:%S')"
                    build_number="${BUILD_NUMBER:-unknown}"

                    git_commit="${DEPLOYED_GIT_COMMIT:-$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")}"

                    git_branch="${DEPLOYED_GIT_BRANCH:-unknown}"

                    git_branch=$(printf '%s' "$git_branch" | sed 's#^origin/##')

                    if [ -z "$git_branch" ]; then
                        git_branch="unknown"
                    fi


                    # =================================================
                    # SERVICE STATUS
                    # =================================================

                    services="backend mysql redis kafka kafka-connect nginx prometheus grafana cadvisor"

                    total_services=0
                    healthy_services=0
                    running_services=0
                    starting_services=0
                    failed_services=0
                    no_healthcheck_services=0

                    : > dashboard/service_cards.html

                    service_status() {

                        service="$1"

                        container_id=$(docker compose ps -q "$service" 2>/dev/null || true)

                        if [ -z "$container_id" ]; then
                            echo "failed|not-found|FAILED"
                            return
                        fi

                        state=$(docker inspect -f '{{.State.Status}}' "$container_id" 2>/dev/null || echo "unknown")

                        health=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container_id" 2>/dev/null || echo "unknown")

                        if [ "$state" != "running" ]; then
                            echo "failed|$state|FAILED"

                        elif [ "$health" = "healthy" ]; then
                            echo "healthy|healthy|HEALTHY"

                        elif [ "$health" = "starting" ]; then
                            echo "starting|starting|STARTING"

                        elif [ "$health" = "none" ]; then
                            echo "running|running|RUNNING"

                        else
                            echo "failed|$health|FAILED"
                        fi
                    }


                    service_icon() {

                        case "$1" in
                            nginx)
                                echo "NG"
                                ;;
                            backend)
                                echo "API"
                                ;;
                            mysql)
                                echo "DB"
                                ;;
                            redis)
                                echo "RD"
                                ;;
                            kafka)
                                echo "KF"
                                ;;
                            kafka-connect)
                                echo "KC"
                                ;;
                            prometheus)
                                echo "PM"
                                ;;
                            grafana)
                                echo "GF"
                                ;;
                            cadvisor)
                                echo "CA"
                                ;;
                            *)
                                echo "SV"
                                ;;
                        esac
                    }


                    service_label() {

                        case "$1" in
                            nginx)
                                echo "Nginx"
                                ;;
                            backend)
                                echo "Node / Express"
                                ;;
                            mysql)
                                echo "MySQL"
                                ;;
                            redis)
                                echo "Redis"
                                ;;
                            kafka)
                                echo "Kafka"
                                ;;
                            kafka-connect)
                                echo "Kafka Connect"
                                ;;
                            prometheus)
                                echo "Prometheus"
                                ;;
                            grafana)
                                echo "Grafana"
                                ;;
                            cadvisor)
                                echo "cAdvisor"
                                ;;
                            *)
                                echo "$1"
                                ;;
                        esac
                    }


                    service_description() {

                        case "$1" in
                            nginx)
                                echo "Reverse Proxy"
                                ;;
                            backend)
                                echo "Backend API"
                                ;;
                            mysql)
                                echo "Application Database"
                                ;;
                            redis)
                                echo "Cache Layer"
                                ;;
                            kafka)
                                echo "Event Streaming"
                                ;;
                            kafka-connect)
                                echo "Debezium Integration"
                                ;;
                            prometheus)
                                echo "Metrics Collection"
                                ;;
                            grafana)
                                echo "Monitoring Dashboard"
                                ;;
                            cadvisor)
                                echo "Container Metrics"
                                ;;
                            *)
                                echo "Docker Service"
                                ;;
                        esac
                    }


                    # =================================================
                    # BUILD SERVICE CARDS
                    # =================================================

                    for service in $services; do

                        total_services=$((total_services + 1))

                        result=$(service_status "$service")

                        status_class=$(printf '%s' "$result" | cut -d'|' -f1)
                        status_value=$(printf '%s' "$result" | cut -d'|' -f2)
                        status_label=$(printf '%s' "$result" | cut -d'|' -f3)

                        if [ "$status_class" = "healthy" ]; then
                            healthy_services=$((healthy_services + 1))
                            running_services=$((running_services + 1))

                        elif [ "$status_class" = "running" ]; then
                            running_services=$((running_services + 1))
                            no_healthcheck_services=$((no_healthcheck_services + 1))

                        elif [ "$status_class" = "starting" ]; then
                            starting_services=$((starting_services + 1))
                            running_services=$((running_services + 1))

                        else
                            failed_services=$((failed_services + 1))
                        fi

                        icon=$(service_icon "$service")
                        label=$(service_label "$service")
                        description=$(service_description "$service")

                        cat >> dashboard/service_cards.html <<EOF
<div class="service-card ${status_class}">
    <div class="service-card-top">
        <div class="service-icon">${icon}</div>
        <div>
            <div class="service-name">${label}</div>
            <div class="service-description">${description}</div>
        </div>
    </div>
    <div class="service-card-status">
        <span class="status-dot"></span>
        ${status_label}
    </div>
    <div class="service-card-meta">
        Docker Compose service: ${service}
    </div>
</div>
EOF

                    done


                    # =================================================
                    # DIAGRAM STATUS VARIABLES
                    # =================================================

                    get_diagram_status() {

                        result=$(service_status "$1")

                        status_class=$(printf '%s' "$result" | cut -d'|' -f1)
                        status_label=$(printf '%s' "$result" | cut -d'|' -f3)

                        echo "${status_class}|${status_label}"
                    }


                    nginx_status=$(get_diagram_status nginx)
                    backend_status=$(get_diagram_status backend)
                    mysql_status=$(get_diagram_status mysql)
                    redis_status=$(get_diagram_status redis)
                    kafka_status=$(get_diagram_status kafka)
                    kafka_connect_status=$(get_diagram_status kafka-connect)
                    prometheus_status=$(get_diagram_status prometheus)
                    grafana_status=$(get_diagram_status grafana)
                    cadvisor_status=$(get_diagram_status cadvisor)


                    # =================================================
                    # CREATE HTML DASHBOARD
                    # =================================================

                    cat > dashboard/index.template.html <<'HTML'

<!DOCTYPE html>

<html lang="en">

<head>

<meta charset="UTF-8">

<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>E-Commerce CI/CD Control Center</title>

<style>

* {
    box-sizing: border-box;
}

body {
    margin: 0;
    background:
        radial-gradient(circle at top left, rgba(56, 189, 248, 0.08), transparent 32%),
        radial-gradient(circle at top right, rgba(139, 92, 246, 0.08), transparent 30%),
        #07111f;
    color: #e5eef8;
    font-family:
        Inter,
        ui-sans-serif,
        system-ui,
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        sans-serif;
}

.container {
    width: min(1500px, 94%);
    margin: 0 auto;
    padding: 32px 0 50px;
}

.hero {
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(148, 163, 184, 0.16);
    border-radius: 22px;
    padding: 34px;
    background:
        linear-gradient(
            135deg,
            rgba(15, 23, 42, 0.96),
            rgba(10, 25, 42, 0.92)
        );
    box-shadow: 0 25px 70px rgba(0, 0, 0, 0.32);
}

.hero:after {
    content: "";
    position: absolute;
    width: 320px;
    height: 320px;
    right: -120px;
    top: -140px;
    border-radius: 50%;
    background: rgba(56, 189, 248, 0.08);
}

.eyebrow {
    color: #38bdf8;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.16em;
    text-transform: uppercase;
}

h1 {
    margin: 8px 0;
    font-size: clamp(28px, 4vw, 48px);
    line-height: 1.05;
}

.hero-subtitle {
    margin-top: 12px;
    color: #94a3b8;
    font-size: 15px;
}

.build-pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-top: 22px;
    padding: 8px 13px;
    border-radius: 999px;
    background: rgba(34, 197, 94, 0.10);
    border: 1px solid rgba(34, 197, 94, 0.30);
    color: #86efac;
    font-weight: 800;
    font-size: 12px;
}

.build-pill .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #22c55e;
    box-shadow: 0 0 12px rgba(34, 197, 94, 0.8);
}

.info-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 14px;
    margin-top: 20px;
}

.info-card {
    padding: 18px;
    border-radius: 15px;
    border: 1px solid rgba(148, 163, 184, 0.14);
    background: rgba(15, 23, 42, 0.76);
}

.info-label {
    color: #64748b;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.10em;
}

.info-value {
    margin-top: 7px;
    color: #f8fafc;
    font-size: 17px;
    font-weight: 800;
    word-break: break-word;
}

.section {
    margin-top: 30px;
}

.section-header {
    margin-bottom: 15px;
}

.section-title {
    font-size: 22px;
    font-weight: 900;
}

.section-subtitle {
    margin-top: 4px;
    color: #64748b;
    font-size: 13px;
}


/* ============================================================
   CI/CD FLOW
   ============================================================ */

.flow {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    flex-wrap: wrap;
    padding: 24px;
    border-radius: 18px;
    border: 1px solid rgba(148, 163, 184, 0.12);
    background: rgba(15, 23, 42, 0.66);
}

.flow-box {
    min-width: 145px;
    text-align: center;
    padding: 17px 20px;
    border-radius: 14px;
    border: 1px solid rgba(56, 189, 248, 0.22);
    background: rgba(15, 23, 42, 0.95);
}

.flow-title {
    color: #f8fafc;
    font-weight: 850;
}

.flow-status {
    margin-top: 5px;
    color: #4ade80;
    font-size: 11px;
    font-weight: 800;
}

.flow-arrow {
    color: #38bdf8;
    font-size: 25px;
    font-weight: 900;
}


/* ============================================================
   ACTUAL ARCHITECTURE DIAGRAM
   ============================================================ */

.architecture-wrapper {
    overflow-x: auto;
    padding-bottom: 8px;
}

.architecture {
    position: relative;
    min-width: 1180px;
    height: 790px;
    overflow: hidden;
    border-radius: 24px;
    border: 1px solid rgba(148, 163, 184, 0.15);
    background:
        linear-gradient(rgba(148, 163, 184, 0.035) 1px, transparent 1px),
        linear-gradient(90deg, rgba(148, 163, 184, 0.035) 1px, transparent 1px),
        #091321;
    background-size: 28px 28px;
}


/* ============================================================
   CSS ARCHITECTURE CONNECTORS
   ============================================================ */

.architecture-connectors {
    position: absolute;
    inset: 0;
    z-index: 3;
    pointer-events: none;
}

.css-arrow {
    position: absolute;
    z-index: 3;
}

.css-arrow.vertical {
    width: 3px;
    background: #38bdf8;
    border-radius: 3px;
}

.css-arrow.vertical::after {
    content: "";
    position: absolute;
    bottom: -1px;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 7px solid transparent;
    border-right: 7px solid transparent;
    border-top: 10px solid #38bdf8;
}

.css-arrow.horizontal {
    height: 3px;
    background: #38bdf8;
    border-radius: 3px;
}

.css-arrow.horizontal::after {
    content: "";
    position: absolute;
    right: -1px;
    top: 50%;
    transform: translateY(-50%);
    width: 0;
    height: 0;
    border-top: 7px solid transparent;
    border-bottom: 7px solid transparent;
    border-left: 10px solid #38bdf8;
}


/* ============================================================
   CI/CD CONNECTORS
   ============================================================ */

.github-to-jenkins {
    left: 590px;
    top: 107px;
    height: 28px;
}

.jenkins-to-compose {
    left: 590px;
    top: 217px;
    height: 20px;
}

.compose-to-app {
    left: 150px;
    top: 307px;
    height: 33px;
}

.compose-to-data {
    left: 665px;
    top: 307px;
    height: 33px;
}

.compose-to-observability {
    left: 590px;
    top: 307px;
    height: 318px;
}


/* ============================================================
   APPLICATION CONNECTORS
   ============================================================ */

.react-to-nginx {
    left: 205px;
    top: 425px;
    width: 175px;
}

.nginx-to-backend {
    left: 380px;
    top: 425px;
    width: 175px;
}


/* ============================================================
   BACKEND → DATA
   ============================================================ */

.backend-to-mysql {
    left: 235px;
    top: 455px;
    width: 430px;
    height: 48px;
    border-left: 3px solid #38bdf8;
    border-bottom: 3px solid #38bdf8;
    border-radius: 0 0 0 10px;
}

.backend-to-mysql::after {
    content: "";
    position: absolute;
    right: -1px;
    bottom: -7px;
    width: 0;
    height: 0;
    border-top: 7px solid transparent;
    border-bottom: 7px solid transparent;
    border-left: 10px solid #38bdf8;
}

.backend-to-redis {
    left: 235px;
    top: 455px;
    width: 560px;
    height: 68px;
    border-left: 3px solid #38bdf8;
    border-bottom: 3px solid #38bdf8;
    border-right: 3px solid #38bdf8;
    border-radius: 0 0 10px 10px;
}

.backend-to-redis::after {
    content: "";
    position: absolute;
    right: -7px;
    bottom: -1px;
    width: 0;
    height: 0;
    border-left: 7px solid transparent;
    border-right: 7px solid transparent;
    border-top: 10px solid #38bdf8;
}


/* ============================================================
   KAFKA → KAFKA CONNECT
   ============================================================ */

.kafka-to-connect {
    left: 995px;
    top: 455px;
    height: 35px;
    background: #a78bfa;
}

.kafka-to-connect::after {
    border-top-color: #a78bfa;
}

.event-arrow {
    background: #a78bfa !important;
}

.event-arrow::after {
    border-top-color: #a78bfa;
}


/* ============================================================
   KAFKA CONNECT → MYSQL
   ============================================================ */

.kafka-connect-to-mysql {
    left: 665px;
    top: 515px;
    width: 265px;
    height: 0;
    border-top: 3px dashed #a78bfa;
}

.kafka-connect-to-mysql::after {
    content: "";
    position: absolute;
    left: -1px;
    top: -7px;
    width: 0;
    height: 0;
    border-top: 7px solid transparent;
    border-bottom: 7px solid transparent;
    border-right: 10px solid #a78bfa;
}


/* ============================================================
   OBSERVABILITY
   ============================================================ */

.metrics-arrow {
    background: #22c55e !important;
}

.metrics-arrow::after {
    border-left-color: #22c55e;
}

.cadvisor-to-prometheus {
    left: 430px;
    top: 680px;
    width: 70px;
}

.prometheus-to-grafana {
    left: 660px;
    top: 680px;
    width: 70px;
}


/* ============================================================
   DIAGRAM GROUPS
   ============================================================ */

.diagram-group {
    position: absolute;
    border: 1px solid rgba(148, 163, 184, 0.14);
    border-radius: 18px;
    background: rgba(15, 23, 42, 0.46);
    z-index: 2;
}

.group-label {
    position: absolute;
    top: 13px;
    left: 18px;
    color: #64748b;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 0.14em;
    text-transform: uppercase;
}


/* ============================================================
   TOP CI/CD NODES
   ============================================================ */

.diagram-node {
    position: absolute;
    z-index: 5;
    width: 170px;
    min-height: 82px;
    padding: 13px;
    border: 1px solid rgba(148, 163, 184, 0.20);
    border-radius: 14px;
    background: rgba(15, 23, 42, 0.96);
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.24);
}

.diagram-node.primary {
    border-color: rgba(56, 189, 248, 0.38);
    background: linear-gradient(
        135deg,
        rgba(14, 116, 144, 0.20),
        rgba(15, 23, 42, 0.98)
    );
}

.diagram-node.database {
    border-color: rgba(251, 191, 36, 0.30);
}

.diagram-node.messaging {
    border-color: rgba(167, 139, 250, 0.34);
}

.diagram-node.monitoring {
    border-color: rgba(34, 197, 94, 0.30);
}

.node-title {
    color: #f8fafc;
    font-size: 14px;
    font-weight: 900;
}

.node-subtitle {
    margin-top: 3px;
    color: #64748b;
    font-size: 10px;
}

.node-status {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 10px;
    color: #94a3b8;
    font-size: 10px;
    font-weight: 800;
}

.node-status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #22c55e;
    box-shadow: 0 0 9px rgba(34, 197, 94, 0.70);
}

.node-status-dot.starting {
    background: #f59e0b;
    box-shadow: 0 0 9px rgba(245, 158, 11, 0.65);
}

.node-status-dot.failed {
    background: #ef4444;
    box-shadow: 0 0 9px rgba(239, 68, 68, 0.65);
}

.node-status-dot.running {
    background: #38bdf8;
    box-shadow: 0 0 9px rgba(56, 189, 248, 0.65);
}


/* ============================================================
   GROUP POSITIONS
   ============================================================ */

.application-group {
    left: 35px;
    top: 270px;
    width: 535px;
    height: 285px;
}

.data-group {
    left: 595px;
    top: 270px;
    width: 550px;
    height: 285px;
}

.observability-group {
    left: 245px;
    top: 585px;
    width: 700px;
    height: 170px;
}


/* ============================================================
   NODE POSITIONS
   ============================================================ */

.github {
    left: 505px;
    top: 25px;
}

.jenkins {
    left: 505px;
    top: 135px;
}

.compose {
    left: 505px;
    top: 225px;
    width: 170px;
}

.nginx {
    left: 35px;
    top: 70px;
}

.backend {
    left: 210px;
    top: 70px;
}

.react {
    left: 385px;
    top: 70px;
}

.mysql {
    left: 35px;
    top: 70px;
}

.redis {
    left: 200px;
    top: 70px;
}

.kafka {
    left: 365px;
    top: 70px;
}

.kafka-connect {
    left: 365px;
    top: 180px;
}

.prometheus {
    left: 190px;
    top: 65px;
}

.grafana {
    left: 370px;
    top: 65px;
}

.cadvisor {
    left: 10px;
    top: 65px;
}


/* ============================================================
   DIAGRAM LEGEND
   ============================================================ */

.diagram-legend {
    position: absolute;
    right: 20px;
    top: 20px;
    z-index: 8;
    display: flex;
    gap: 14px;
    align-items: center;
    padding: 9px 12px;
    border-radius: 10px;
    background: rgba(2, 6, 23, 0.78);
    border: 1px solid rgba(148, 163, 184, 0.12);
    font-size: 10px;
    color: #94a3b8;
}

.legend-item {
    display: flex;
    align-items: center;
    gap: 5px;
}

.legend-line {
    width: 22px;
    height: 2px;
    background: #38bdf8;
}

.legend-line.event {
    background: #a78bfa;
}

.legend-line.metrics {
    background: #22c55e;
}


/* ============================================================
   SERVICE HEALTH
   ============================================================ */

.health-summary {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 14px;
}

.metric-card {
    padding: 20px;
    border-radius: 16px;
    border: 1px solid rgba(148, 163, 184, 0.13);
    background: rgba(15, 23, 42, 0.72);
}

.metric-number {
    font-size: 28px;
    font-weight: 950;
}

.metric-label {
    margin-top: 5px;
    color: #64748b;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
}

.service-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 15px;
    margin-top: 15px;
}

.service-card {
    padding: 18px;
    border-radius: 17px;
    border: 1px solid rgba(148, 163, 184, 0.14);
    background: rgba(15, 23, 42, 0.76);
}

.service-card.healthy {
    border-color: rgba(34, 197, 94, 0.25);
}

.service-card.running {
    border-color: rgba(56, 189, 248, 0.25);
}

.service-card.starting {
    border-color: rgba(245, 158, 11, 0.28);
}

.service-card.failed {
    border-color: rgba(239, 68, 68, 0.30);
}

.service-card-top {
    display: flex;
    align-items: center;
    gap: 12px;
}

.service-icon {
    width: 38px;
    height: 38px;
    display: grid;
    place-items: center;
    border-radius: 10px;
    background: rgba(56, 189, 248, 0.10);
    color: #7dd3fc;
    font-size: 10px;
    font-weight: 950;
}

.service-name {
    font-weight: 900;
}

.service-description {
    margin-top: 3px;
    color: #64748b;
    font-size: 11px;
}

.service-card-status {
    display: flex;
    align-items: center;
    gap: 7px;
    margin-top: 17px;
    color: #86efac;
    font-size: 11px;
    font-weight: 900;
}

.service-card.running .service-card-status {
    color: #7dd3fc;
}

.service-card.starting .service-card-status {
    color: #fbbf24;
}

.service-card.failed .service-card-status {
    color: #f87171;
}

.status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #22c55e;
}

.service-card.running .status-dot {
    background: #38bdf8;
}

.service-card.starting .status-dot {
    background: #f59e0b;
}

.service-card.failed .status-dot {
    background: #ef4444;
}

.service-card-meta {
    margin-top: 10px;
    color: #475569;
    font-size: 10px;
}


/* ============================================================
   FOOTER
   ============================================================ */

.footer {
    margin-top: 32px;
    padding-top: 20px;
    border-top: 1px solid rgba(148, 163, 184, 0.10);
    color: #475569;
    text-align: center;
    font-size: 11px;
}


/* ============================================================
   RESPONSIVE
   ============================================================ */

@media (max-width: 900px) {

    .info-grid,
    .health-summary {
        grid-template-columns: repeat(2, 1fr);
    }

    .service-grid {
        grid-template-columns: 1fr;
    }

}

</style>

</head>


<body>

<div class="container">


    <!-- ========================================================
         HERO
         ======================================================== -->

    <section class="hero">

        <div class="eyebrow">
            E-Commerce DevOps Platform
        </div>

        <h1>
            CI/CD Control Center
        </h1>

        <div class="hero-subtitle">
            GitHub → Jenkins → Docker Compose → Service Verification
        </div>

        <div class="build-pill">
            <span class="dot"></span>
            BUILD #__BUILD_NUMBER__ • SUCCESS
        </div>

    </section>


    <!-- ========================================================
         BUILD INFORMATION
         ======================================================== -->

    <section class="info-grid">

        <div class="info-card">

            <div class="info-label">
                Git Commit
            </div>

            <div class="info-value">
                __GIT_COMMIT__
            </div>

        </div>


        <div class="info-card">

            <div class="info-label">
                Git Branch
            </div>

            <div class="info-value">
                __GIT_BRANCH__
            </div>

        </div>


        <div class="info-card">

            <div class="info-label">
                Jenkins Build
            </div>

            <div class="info-value">
                #__BUILD_NUMBER__
            </div>

        </div>


        <div class="info-card">

            <div class="info-label">
                Platform
            </div>

            <div class="info-value">
                Docker Compose
            </div>

        </div>

    </section>


    <!-- ========================================================
         CI/CD PIPELINE FLOW
         ======================================================== -->

    <section class="section">

        <div class="section-header">

            <div class="section-title">
                CI/CD Pipeline Flow
            </div>

            <div class="section-subtitle">
                Jenkins execution path for the current deployment
            </div>

        </div>


        <div class="flow">

            <div class="flow-box">

                <div class="flow-title">
                    GitHub
                </div>

                <div class="flow-status">
                    COMMIT
                </div>

            </div>


            <div class="flow-arrow">
                →
            </div>


            <div class="flow-box">

                <div class="flow-title">
                    Jenkins
                </div>

                <div class="flow-status">
                    BUILD #__BUILD_NUMBER__
                </div>

            </div>


            <div class="flow-arrow">
                →
            </div>


            <div class="flow-box">

                <div class="flow-title">
                    Validate
                </div>

                <div class="flow-status">
                    COMPLETED
                </div>

            </div>


            <div class="flow-arrow">
                →
            </div>


            <div class="flow-box">

                <div class="flow-title">
                    Docker Build
                </div>

                <div class="flow-status">
                    COMPLETED
                </div>

            </div>


            <div class="flow-arrow">
                →
            </div>


            <div class="flow-box">

                <div class="flow-title">
                    Deploy
                </div>

                <div class="flow-status">
                    COMPLETED
                </div>

            </div>


            <div class="flow-arrow">
                →
            </div>


            <div class="flow-box">

                <div class="flow-title">
                    Verify
                </div>

                <div class="flow-status">
                    __RUNNING_SERVICES__/__TOTAL_SERVICES__ RUNNING
                </div>

            </div>

        </div>

    </section>


    <!-- ========================================================
         ACTUAL ARCHITECTURE
         ======================================================== -->

    <section class="section">

        <div class="section-header">

            <div class="section-title">
                E-Commerce Architecture
            </div>

            <div class="section-subtitle">
                Live deployment topology — application, data/event and observability paths
            </div>

        </div>


        <div class="architecture-wrapper">

            <div class="architecture">


                <!-- ==================================================
                     CSS CONNECTOR LAYER
                     ================================================== -->

                <div class="architecture-connectors">

                    <!-- GitHub → Jenkins -->
                    <div class="css-arrow vertical github-to-jenkins"></div>

                    <!-- Jenkins → Docker Compose -->
                    <div class="css-arrow vertical jenkins-to-compose"></div>

                    <!-- Docker Compose → Application -->
                    <div class="css-arrow vertical compose-to-app"></div>

                    <!-- Docker Compose → Data -->
                    <div class="css-arrow vertical compose-to-data"></div>

                    <!-- Docker Compose → Observability -->
                    <div class="css-arrow vertical compose-to-observability"></div>

                    <!-- React → Nginx -->
                    <div class="css-arrow horizontal react-to-nginx"></div>

                    <!-- Nginx → Backend -->
                    <div class="css-arrow horizontal nginx-to-backend"></div>

                    <!-- Backend → MySQL -->
                    <div class="css-arrow backend-to-mysql"></div>

                    <!-- Backend → Redis -->
                    <div class="css-arrow backend-to-redis"></div>

                    <!-- Kafka → Kafka Connect -->
                    <div class="css-arrow vertical kafka-to-connect event-arrow"></div>

                    <!-- Kafka Connect → MySQL -->
                    <div class="css-arrow kafka-connect-to-mysql event-arrow"></div>

                    <!-- cAdvisor → Prometheus -->
                    <div class="css-arrow horizontal cadvisor-to-prometheus metrics-arrow"></div>

                    <!-- Prometheus → Grafana -->
                    <div class="css-arrow horizontal prometheus-to-grafana metrics-arrow"></div>

                </div>


                <!-- ==================================================
                     LEGEND
                     ================================================== -->

                <div class="diagram-legend">

                    <div class="legend-item">
                        <span class="legend-line"></span>
                        Application / deployment
                    </div>

                    <div class="legend-item">
                        <span class="legend-line event"></span>
                        Event / CDC
                    </div>

                    <div class="legend-item">
                        <span class="legend-line metrics"></span>
                        Metrics
                    </div>

                </div>


                <!-- ==================================================
                     GITHUB
                     ================================================== -->

                <div class="diagram-node primary github">

                    <div class="node-title">
                        GitHub
                    </div>

                    <div class="node-subtitle">
                        e-commerce repository
                    </div>

                    <div class="node-status">

                        <span class="node-status-dot running"></span>

                        __GIT_BRANCH__

                    </div>

                </div>


                <!-- ==================================================
                     JENKINS
                     ================================================== -->

                <div class="diagram-node primary jenkins">

                    <div class="node-title">
                        Jenkins CI/CD
                    </div>

                    <div class="node-subtitle">
                        Pipeline Controller
                    </div>

                    <div class="node-status">

                        <span class="node-status-dot running"></span>

                        BUILD #__BUILD_NUMBER__

                    </div>

                </div>


                <!-- ==================================================
                     DOCKER COMPOSE
                     ================================================== -->

                <div class="diagram-node primary compose">

                    <div class="node-title">
                        Docker Compose
                    </div>

                    <div class="node-subtitle">
                        Container Orchestration
                    </div>

                    <div class="node-status">

                        <span class="node-status-dot running"></span>

                        __RUNNING_SERVICES__/__TOTAL_SERVICES__ RUNNING

                    </div>

                </div>


                <!-- ==================================================
                     APPLICATION GROUP
                     ================================================== -->

                <div class="diagram-group application-group">

                    <div class="group-label">
                        APPLICATION
                    </div>


                    <div class="diagram-node nginx">

                        <div class="node-title">
                            Nginx
                        </div>

                        <div class="node-subtitle">
                            Reverse Proxy
                        </div>

                        <div class="node-status">

                            <span class="node-status-dot __NGINX_STATUS_CLASS__"></span>

                            __NGINX_STATUS__

                        </div>

                    </div>


                    <div class="diagram-node backend">

                        <div class="node-title">
                            Node / Express
                        </div>

                        <div class="node-subtitle">
                            Backend API
                        </div>

                        <div class="node-status">

                            <span class="node-status-dot __BACKEND_STATUS_CLASS__"></span>

                            __BACKEND_STATUS__

                        </div>

                    </div>


                    <div class="diagram-node react">

                        <div class="node-title">
                            React
                        </div>

                        <div class="node-subtitle">
                            Frontend
                        </div>

                        <div class="node-status">

                            <span class="node-status-dot running"></span>

                            APPLICATION

                        </div>

                    </div>

                </div>


                <!-- ==================================================
                     DATA & EVENTS GROUP
                     ================================================== -->

                <div class="diagram-group data-group">

                    <div class="group-label">
                        DATA & EVENTS
                    </div>


                    <div class="diagram-node database mysql">

                        <div class="node-title">
                            MySQL
                        </div>

                        <div class="node-subtitle">
                            Application Database
                        </div>

                        <div class="node-status">

                            <span class="node-status-dot __MYSQL_STATUS_CLASS__"></span>

                            __MYSQL_STATUS__

                        </div>

                    </div>


                    <div class="diagram-node database redis">

                        <div class="node-title">
                            Redis
                        </div>

                        <div class="node-subtitle">
                            Cache Layer
                        </div>

                        <div class="node-status">

                            <span class="node-status-dot __REDIS_STATUS_CLASS__"></span>

                            __REDIS_STATUS__

                        </div>

                    </div>


                    <div class="diagram-node messaging kafka">

                        <div class="node-title">
                            Kafka
                        </div>

                        <div class="node-subtitle">
                            Event Streaming
                        </div>

                        <div class="node-status">

                            <span class="node-status-dot __KAFKA_STATUS_CLASS__"></span>

                            __KAFKA_STATUS__

                        </div>

                    </div>


                    <div class="diagram-node messaging kafka-connect">

                        <div class="node-title">
                            Kafka Connect
                        </div>

                        <div class="node-subtitle">
                            Debezium Integration
                        </div>

                        <div class="node-status">

                            <span class="node-status-dot __KAFKA_CONNECT_STATUS_CLASS__"></span>

                            __KAFKA_CONNECT_STATUS__

                        </div>

                    </div>

                </div>


                <!-- ==================================================
                     OBSERVABILITY GROUP
                     ================================================== -->

                <div class="diagram-group observability-group">

                    <div class="group-label">
                        OBSERVABILITY
                    </div>


                    <div class="diagram-node monitoring cadvisor">

                        <div class="node-title">
                            cAdvisor
                        </div>

                        <div class="node-subtitle">
                            Container Metrics
                        </div>

                        <div class="node-status">

                            <span class="node-status-dot __CADVISOR_STATUS_CLASS__"></span>

                            __CADVISOR_STATUS__

                        </div>

                    </div>


                    <div class="diagram-node monitoring prometheus">

                        <div class="node-title">
                            Prometheus
                        </div>

                        <div class="node-subtitle">
                            Metrics Collection
                        </div>

                        <div class="node-status">

                            <span class="node-status-dot __PROMETHEUS_STATUS_CLASS__"></span>

                            __PROMETHEUS_STATUS__

                        </div>

                    </div>


                    <div class="diagram-node monitoring grafana">

                        <div class="node-title">
                            Grafana
                        </div>

                        <div class="node-subtitle">
                            Monitoring Dashboard
                        </div>

                        <div class="node-status">

                            <span class="node-status-dot __GRAFANA_STATUS_CLASS__"></span>

                            __GRAFANA_STATUS__

                        </div>

                    </div>

                </div>

            </div>

        </div>

    </section>


    <!-- ========================================================
         DEPLOYMENT STATUS
         ======================================================== -->

    <section class="section">

        <div class="section-header">

            <div class="section-title">
                Deployment Status
            </div>

            <div class="section-subtitle">
                Current Docker Compose deployment state
            </div>

        </div>


        <div class="health-summary">

            <div class="metric-card">

                <div class="metric-number">
                    __TOTAL_SERVICES__
                </div>

                <div class="metric-label">
                    Total Services
                </div>

            </div>


            <div class="metric-card">

                <div class="metric-number">
                    __HEALTHY_SERVICES__
                </div>

                <div class="metric-label">
                    Healthchecks Passing
                </div>

            </div>


            <div class="metric-card">

                <div class="metric-number">
                    __RUNNING_SERVICES__
                </div>

                <div class="metric-label">
                    Running
                </div>

            </div>


            <div class="metric-card">

                <div class="metric-number">
                    __FAILED_SERVICES__
                </div>

                <div class="metric-label">
                    Failed
                </div>

            </div>


            <div class="metric-card">

                <div class="metric-number">
                    __NO_HEALTHCHECK_SERVICES__
                </div>

                <div class="metric-label">
                    Running Without Healthcheck
                </div>

            </div>

        </div>

    </section>


    <!-- ========================================================
         SERVICE HEALTH
         ======================================================== -->

    <section class="section">

        <div class="section-header">

            <div class="section-title">
                Service Health
            </div>

            <div class="section-subtitle">
                Live status collected directly from Docker containers
            </div>

        </div>


        <div class="service-grid">

            __SERVICE_CARDS__

        </div>

    </section>


    <!-- ========================================================
         FOOTER
         ======================================================== -->

    <div class="footer">

        Generated by Jenkins Build #__BUILD_NUMBER__
        •
        __GENERATED__

    </div>


</div>

</body>

</html>

HTML


                    # =================================================
                    # PREPARE DIAGRAM STATUS VALUES
                    # =================================================

                    nginx_status_class=$(printf '%s' "$nginx_status" | cut -d'|' -f1)
                    nginx_status_label=$(printf '%s' "$nginx_status" | cut -d'|' -f2)

                    backend_status_class=$(printf '%s' "$backend_status" | cut -d'|' -f1)
                    backend_status_label=$(printf '%s' "$backend_status" | cut -d'|' -f2)

                    mysql_status_class=$(printf '%s' "$mysql_status" | cut -d'|' -f1)
                    mysql_status_label=$(printf '%s' "$mysql_status" | cut -d'|' -f2)

                    redis_status_class=$(printf '%s' "$redis_status" | cut -d'|' -f1)
                    redis_status_label=$(printf '%s' "$redis_status" | cut -d'|' -f2)

                    kafka_status_class=$(printf '%s' "$kafka_status" | cut -d'|' -f1)
                    kafka_status_label=$(printf '%s' "$kafka_status" | cut -d'|' -f2)

                    kafka_connect_status_class=$(printf '%s' "$kafka_connect_status" | cut -d'|' -f1)
                    kafka_connect_status_label=$(printf '%s' "$kafka_connect_status" | cut -d'|' -f2)

                    prometheus_status_class=$(printf '%s' "$prometheus_status" | cut -d'|' -f1)
                    prometheus_status_label=$(printf '%s' "$prometheus_status" | cut -d'|' -f2)

                    grafana_status_class=$(printf '%s' "$grafana_status" | cut -d'|' -f1)
                    grafana_status_label=$(printf '%s' "$grafana_status" | cut -d'|' -f2)

                    cadvisor_status_class=$(printf '%s' "$cadvisor_status" | cut -d'|' -f1)
                    cadvisor_status_label=$(printf '%s' "$cadvisor_status" | cut -d'|' -f2)


                    # =================================================
                    # SUBSTITUTE SCALAR VALUES
                    # =================================================

                    sed \
                        -e "s#__BUILD_NUMBER__#${build_number}#g" \
                        -e "s#__GIT_COMMIT__#${git_commit}#g" \
                        -e "s#__GIT_BRANCH__#${git_branch}#g" \
                        -e "s#__GENERATED__#${generated}#g" \
                        -e "s#__TOTAL_SERVICES__#${total_services}#g" \
                        -e "s#__HEALTHY_SERVICES__#${healthy_services}#g" \
                        -e "s#__RUNNING_SERVICES__#${running_services}#g" \
                        -e "s#__STARTING_SERVICES__#${starting_services}#g" \
                        -e "s#__FAILED_SERVICES__#${failed_services}#g" \
                        -e "s#__NO_HEALTHCHECK_SERVICES__#${no_healthcheck_services}#g" \
                        -e "s#__NGINX_STATUS_CLASS__#${nginx_status_class}#g" \
                        -e "s#__NGINX_STATUS__#${nginx_status_label}#g" \
                        -e "s#__BACKEND_STATUS_CLASS__#${backend_status_class}#g" \
                        -e "s#__BACKEND_STATUS__#${backend_status_label}#g" \
                        -e "s#__MYSQL_STATUS_CLASS__#${mysql_status_class}#g" \
                        -e "s#__MYSQL_STATUS__#${mysql_status_label}#g" \
                        -e "s#__REDIS_STATUS_CLASS__#${redis_status_class}#g" \
                        -e "s#__REDIS_STATUS__#${redis_status_label}#g" \
                        -e "s#__KAFKA_STATUS_CLASS__#${kafka_status_class}#g" \
                        -e "s#__KAFKA_STATUS__#${kafka_status_label}#g" \
                        -e "s#__KAFKA_CONNECT_STATUS_CLASS__#${kafka_connect_status_class}#g" \
                        -e "s#__KAFKA_CONNECT_STATUS__#${kafka_connect_status_label}#g" \
                        -e "s#__PROMETHEUS_STATUS_CLASS__#${prometheus_status_class}#g" \
                        -e "s#__PROMETHEUS_STATUS__#${prometheus_status_label}#g" \
                        -e "s#__GRAFANA_STATUS_CLASS__#${grafana_status_class}#g" \
                        -e "s#__GRAFANA_STATUS__#${grafana_status_label}#g" \
                        -e "s#__CADVISOR_STATUS_CLASS__#${cadvisor_status_class}#g" \
                        -e "s#__CADVISOR_STATUS__#${cadvisor_status_label}#g" \
                        dashboard/index.template.html \
                        > dashboard/index.html


                    # =================================================
                    # SAFELY INSERT SERVICE CARDS
                    # =================================================

                    awk '
                        FILENAME == ARGV[1] {
                            cards = cards $0 ORS
                            next
                        }

                        $0 == "__SERVICE_CARDS__" {
                            printf "%s", cards
                            next
                        }

                        {
                            print
                        }
                    ' dashboard/service_cards.html dashboard/index.html \
                        > dashboard/index.final.html


                    mv dashboard/index.final.html dashboard/index.html


                    # =================================================
                    # VALIDATE GENERATED DASHBOARD
                    # =================================================

                    test -s dashboard/index.html

                    grep -q "E-Commerce Architecture" dashboard/index.html

                    grep -q "GitHub" dashboard/index.html

                    grep -q "Jenkins CI/CD" dashboard/index.html

                    grep -q "Docker Compose" dashboard/index.html

                    grep -q "Nginx" dashboard/index.html

                    grep -q "Node / Express" dashboard/index.html

                    grep -q "MySQL" dashboard/index.html

                    grep -q "Redis" dashboard/index.html

                    grep -q "Kafka" dashboard/index.html

                    grep -q "Kafka Connect" dashboard/index.html

                    grep -q "Prometheus" dashboard/index.html

                    grep -q "Grafana" dashboard/index.html

                    grep -q "cAdvisor" dashboard/index.html

                    grep -q "architecture-connectors" dashboard/index.html

                    grep -q "github-to-jenkins" dashboard/index.html

                    grep -q "prometheus-to-grafana" dashboard/index.html


                    # =================================================
                    # CLEAN TEMP FILES
                    # =================================================

                    rm -f dashboard/index.template.html
                    rm -f dashboard/service_cards.html


                    echo ""
                    echo "========================================="
                    echo "Architecture dashboard generated"
                    echo "========================================="

                    echo "Build: ${build_number}"
                    echo "Commit: ${git_commit}"
                    echo "Branch: ${git_branch}"
                    echo "Total services: ${total_services}"
                    echo "Healthy services: ${healthy_services}"
                    echo "Running services: ${running_services}"
                    echo "Starting services: ${starting_services}"
                    echo "Failed services: ${failed_services}"
                    echo "No healthcheck services: ${no_healthcheck_services}"

                    echo ""
                    echo "Dashboard:"
                    ls -lh dashboard/index.html
                '''
            }
        }
    }


    // ================================================================
    // POST ACTIONS
    // ================================================================

    post {

        always {

            echo '========================================='
            echo 'Final Docker Service Status'
            echo '========================================='

            sh '''
                docker compose ps || true
            '''


            echo '========================================='
            echo 'Publishing Architecture Dashboard'
            echo '========================================='

            script {

                if (fileExists('dashboard/index.html')) {

                    publishHTML(
                        target: [
                            allowMissing: false,
                            alwaysLinkToLastBuild: true,
                            keepAll: true,
                            reportDir: 'dashboard',
                            reportFiles: 'index.html',
                            reportName: 'E-Commerce CI/CD Architecture Dashboard',
                            reportTitles: 'E-Commerce CI/CD Control Center'
                        ]
                    )

                } else {

                    echo 'Dashboard file was not generated.'

                }
            }


            archiveArtifacts(
                artifacts: 'dashboard/index.html',
                allowEmptyArchive: true,
                fingerprint: true
            )
        }


        success {

            echo '''
            =========================================
            E-COMMERCE CI/CD PIPELINE SUCCESS
            =========================================
            Build completed successfully.
            Architecture dashboard published.
            =========================================
            '''
        }


        failure {

            echo '''
            =========================================
            E-COMMERCE CI/CD PIPELINE FAILED
            =========================================
            Check the Jenkins console output.
            =========================================
            '''
        }
    }
}