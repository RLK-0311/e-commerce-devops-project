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

        // =========================================================
        // CHECKOUT
        // =========================================================
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


        // =========================================================
        // PROJECT VALIDATION
        // =========================================================
        stage('Validate Project') {
            steps {
                sh '''
                    set -e

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

                    echo ""
                    echo "Validating Docker Compose configuration..."

                    docker compose config --quiet

                    echo ""
                    echo "Project validation passed"
                '''
            }
        }


        // =========================================================
        // DOCKER SERVICES
        // =========================================================
        stage('Docker Services') {
            parallel {

                stage('Build Application Images') {
                    steps {
                        sh '''
                            set -e

                            echo "========================================="
                            echo "Building application-owned images"
                            echo "========================================="

                            docker compose build \
                                backend \
                                nginx \
                                prometheus

                            echo ""
                            echo "Application images built successfully"
                        '''
                    }
                }


                stage('Pull Infrastructure Images') {
                    steps {
                        sh '''
                            set -e

                            echo "========================================="
                            echo "Pulling infrastructure images"
                            echo "========================================="

                            docker compose pull \
                                mysql \
                                redis \
                                kafka \
                                kafka-connect \
                                grafana \
                                cadvisor

                            echo ""
                            echo "Infrastructure images pulled successfully"
                        '''
                    }
                }
            }
        }


        // =========================================================
        // DOCKER COMPOSE VALIDATION
        // =========================================================
        stage('Docker Compose Validation') {
            steps {
                sh '''
                    set -e

                    echo "========================================="
                    echo "Docker Compose validation"
                    echo "========================================="

                    docker compose config --quiet

                    echo ""
                    echo "Docker Compose configuration is valid"
                '''
            }
        }


        // =========================================================
        // DOCKER IMAGES
        // =========================================================
        stage('Docker Images') {
            steps {
                sh '''
                    set -e

                    echo "========================================="
                    echo "Docker images"
                    echo "========================================="

                    docker compose images
                '''
            }
        }


        // =========================================================
        // DEPLOYMENT
        // =========================================================
        stage('Docker Deployment') {
            steps {
                sh '''
                    set -e

                    echo "========================================="
                    echo "Deploying E-Commerce platform"
                    echo "========================================="

                    docker compose up -d --remove-orphans

                    echo ""
                    echo "Docker Compose deployment completed"
                '''
            }
        }


        // =========================================================
        // SERVICE VERIFICATION
        // =========================================================
        stage('Service Verification') {
            steps {
                sh '''
                    set -e

                    echo "========================================="
                    echo "Verifying Docker services"
                    echo "========================================="

                    services="backend mysql redis kafka kafka-connect nginx prometheus grafana cadvisor"

                    max_attempts=24
                    attempt=1

                    while [ "$attempt" -le "$max_attempts" ]; do

                        echo ""
                        echo "Verification attempt $attempt/$max_attempts"
                        echo "-----------------------------------------"

                        failed=0
                        starting=0

                        printf "%-20s %-15s %-15s\\n" \
                            "SERVICE" "STATE" "HEALTH"

                        printf "%-20s %-15s %-15s\\n" \
                            "-------" "-----" "------"


                        for service in $services; do

                            container_id=$(docker compose ps -q "$service" 2>/dev/null || true)

                            if [ -z "$container_id" ]; then

                                printf "%-20s %-15s %-15s\\n" \
                                    "$service" "MISSING" "-"

                                failed=1
                                continue
                            fi


                            state=$(docker inspect \
                                -f '{{.State.Status}}' \
                                "$container_id" \
                                2>/dev/null || echo "unknown")


                            health=$(docker inspect \
                                -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' \
                                "$container_id" \
                                2>/dev/null || echo "unknown")


                            printf "%-20s %-15s %-15s\\n" \
                                "$service" "$state" "$health"


                            if [ "$state" != "running" ]; then

                                failed=1

                            elif [ "$health" = "starting" ]; then

                                starting=1

                            elif [ "$health" != "healthy" ] && \
                                 [ "$health" != "none" ]; then

                                failed=1

                            fi

                        done


                        echo ""


                        if [ "$failed" -eq 0 ] && [ "$starting" -eq 0 ]; then

                            echo "========================================="
                            echo "All required Docker services are healthy/running."
                            echo "========================================="

                            exit 0

                        fi


                        if [ "$failed" -eq 1 ] && [ "$starting" -eq 0 ]; then

                            echo "========================================="
                            echo "One or more services failed verification."
                            echo "========================================="

                            exit 1

                        fi


                        echo "Some services are still starting."
                        echo "Waiting 5 seconds before checking again..."

                        sleep 5

                        attempt=$((attempt + 1))

                    done


                    echo "========================================="
                    echo "Service verification timed out."
                    echo "========================================="


                    echo ""
                    echo "Final Docker Compose status:"
                    docker compose ps


                    echo ""
                    echo "Backend logs:"
                    docker compose logs --tail=50 backend


                    echo ""
                    echo "Recent backend health-check information:"

                    backend_container=$(docker compose ps -q backend 2>/dev/null || true)

                    if [ -n "$backend_container" ]; then

                        docker inspect \
                            -f '{{range .State.Health.Log}}{{.Start}} | Exit={{.ExitCode}} | {{.Output}}{{"\\n"}}{{end}}' \
                            "$backend_container" \
                            2>/dev/null || true

                    fi


                    exit 1
                '''
            }
        }


        // =========================================================
        // GENERATE VISUAL CI/CD DASHBOARD
        // =========================================================
        stage('Generate Architecture Dashboard') {
            steps {
                sh '''
                    set -e

                    echo "========================================="
                    echo "Generating E-Commerce CI/CD Dashboard"
                    echo "========================================="

                    mkdir -p dashboard

                    generated=$(date '+%Y-%m-%d %H:%M:%S')
                    build_number="${BUILD_NUMBER:-N/A}"

                    git_commit="${DEPLOYED_GIT_COMMIT:-$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")}"

                    git_branch="${DEPLOYED_GIT_BRANCH:-unknown}"

                    git_branch=$(printf '%s' "$git_branch" | sed 's#^origin/##')

                    if [ -z "$git_branch" ]; then
                        git_branch="unknown"
                    fi


                    # -------------------------------------------------
                    # SERVICES
                    # -------------------------------------------------
                    services="backend mysql redis kafka kafka-connect nginx prometheus grafana cadvisor"


                    # -------------------------------------------------
                    # SERVICE COUNTERS
                    # -------------------------------------------------
                    total_services=0
                    healthy_services=0
                    running_services=0
                    starting_services=0
                    failed_services=0


                    # -------------------------------------------------
                    # SERVICE CARDS
                    # -------------------------------------------------
                    : > dashboard/service_cards.html


                    for service in $services; do

                        total_services=$((total_services + 1))

                        container_id=$(docker compose ps -q "$service" 2>/dev/null || true)


                        if [ -z "$container_id" ]; then

                            status="FAILED"
                            detail="Container not found"
                            status_class="failed"
                            status_icon="×"
                            container_name="N/A"
                            image_name="N/A"

                            failed_services=$((failed_services + 1))

                        else

                            state=$(docker inspect \
                                -f '{{.State.Status}}' \
                                "$container_id" \
                                2>/dev/null || echo "unknown")


                            health=$(docker inspect \
                                -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' \
                                "$container_id" \
                                2>/dev/null || echo "unknown")


                            container_name=$(docker inspect \
                                -f '{{.Name}}' \
                                "$container_id" \
                                2>/dev/null | sed 's#^/##' || echo "$service")


                            image_name=$(docker inspect \
                                -f '{{.Config.Image}}' \
                                "$container_id" \
                                2>/dev/null || echo "unknown")


                            if [ "$state" = "running" ] && \
                               [ "$health" = "healthy" ]; then

                                status="HEALTHY"
                                detail="Running and healthy"
                                status_class="healthy"
                                status_icon="✓"

                                healthy_services=$((healthy_services + 1))
                                running_services=$((running_services + 1))

                            elif [ "$state" = "running" ] && \
                                 [ "$health" = "none" ]; then

                                status="RUNNING"
                                detail="Running without healthcheck"
                                status_class="running"
                                status_icon="●"

                                running_services=$((running_services + 1))

                            elif [ "$state" = "running" ] && \
                                 [ "$health" = "starting" ]; then

                                status="STARTING"
                                detail="Healthcheck still starting"
                                status_class="starting"
                                status_icon="◐"

                                starting_services=$((starting_services + 1))
                                running_services=$((running_services + 1))

                            else

                                status="FAILED"
                                detail="State: $state | Health: $health"
                                status_class="failed"
                                status_icon="×"

                                failed_services=$((failed_services + 1))

                            fi

                        fi


                        cat >> dashboard/service_cards.html <<EOF
<div class="service-card ${status_class}">
    <div class="service-card-top">
        <div class="service-pictogram ${status_class}">
            ${status_icon}
        </div>

        <div class="service-card-name">
            ${service}
        </div>

        <div class="service-status-pill ${status_class}">
            ${status}
        </div>
    </div>

    <div class="service-detail">
        ${detail}
    </div>

    <div class="service-meta">
        <div>
            <span>Container</span>
            <strong>${container_name}</strong>
        </div>

        <div>
            <span>Image</span>
            <strong>${image_name}</strong>
        </div>
    </div>
</div>
EOF

                    done


                    # -------------------------------------------------
                    # DEPLOYMENT STATUS
                    # -------------------------------------------------
                    if [ "$failed_services" -eq 0 ]; then
                        deployment_status="HEALTHY"
                        deployment_class="healthy"
                        deployment_description="All required Docker services are running and verified."
                    else
                        deployment_status="DEGRADED"
                        deployment_class="failed"
                        deployment_description="One or more Docker services failed verification."
                    fi


                    # -------------------------------------------------
                    # GENERATE HTML TEMPLATE
                    # -------------------------------------------------
                    cat > dashboard/index.template.html <<'HTML_TEMPLATE'
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
    background: #eef2f7;
    color: #17202a;
    font-family:
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        Arial,
        sans-serif;
}

.container {
    max-width: 1500px;
    margin: 0 auto;
    padding: 28px;
}


/* =========================================================
   HEADER
   ========================================================= */

.hero {
    position: relative;
    overflow: hidden;
    padding: 32px;
    border-radius: 20px;
    color: white;
    background:
        linear-gradient(135deg, #101820 0%, #1f3448 55%, #253f55 100%);
    box-shadow: 0 12px 35px rgba(16, 24, 32, .18);
    margin-bottom: 20px;
}

.hero:after {
    content: "";
    position: absolute;
    width: 260px;
    height: 260px;
    border-radius: 50%;
    right: -90px;
    top: -100px;
    border: 35px solid rgba(255,255,255,.05);
}

.hero-content {
    position: relative;
    z-index: 2;
}

.hero-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 20px;
}

.eyebrow {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 2px;
    color: #9fb3c8;
    font-weight: 700;
    margin-bottom: 8px;
}

.hero h1 {
    margin: 0;
    font-size: 34px;
    line-height: 1.15;
}

.hero-description {
    margin-top: 10px;
    color: #c8d3de;
    font-size: 14px;
}

.success-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 11px 17px;
    border-radius: 30px;
    background: #1e8449;
    font-size: 13px;
    font-weight: 800;
    white-space: nowrap;
}

.success-dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: #d5f5e3;
}


/* =========================================================
   BUILD INFORMATION
   ========================================================= */

.info-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 14px;
    margin-bottom: 20px;
}

.info-card {
    background: white;
    border: 1px solid #e1e7ed;
    border-radius: 14px;
    padding: 18px;
    box-shadow: 0 4px 14px rgba(20, 30, 40, .05);
}

.info-label {
    color: #82909d;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 1.2px;
    font-weight: 800;
}

.info-value {
    margin-top: 8px;
    font-size: 20px;
    font-weight: 800;
    word-break: break-word;
}

.info-sub {
    margin-top: 4px;
    color: #8a969f;
    font-size: 11px;
}


/* =========================================================
   SECTIONS
   ========================================================= */

.section {
    background: white;
    border: 1px solid #e1e7ed;
    border-radius: 18px;
    padding: 25px;
    margin-bottom: 20px;
    box-shadow: 0 4px 14px rgba(20, 30, 40, .05);
}

.section-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 15px;
    margin-bottom: 5px;
}

.section-title {
    font-size: 21px;
    font-weight: 800;
}

.section-subtitle {
    color: #82909d;
    font-size: 13px;
    margin-bottom: 22px;
}


/* =========================================================
   CI/CD FLOW
   ========================================================= */

.flow {
    display: flex;
    align-items: stretch;
    justify-content: center;
    gap: 0;
}

.flow-node {
    position: relative;
    flex: 1;
    max-width: 210px;
    min-width: 150px;
    text-align: center;
}

.flow-card {
    height: 145px;
    padding: 18px 12px;
    border-radius: 16px;
    border: 2px solid #a9dfbf;
    background: #f1fbf5;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}

.flow-icon {
    width: 46px;
    height: 46px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #1e8449;
    color: white;
    font-size: 20px;
    font-weight: 900;
    margin-bottom: 10px;
}

.flow-title {
    font-size: 14px;
    font-weight: 800;
}

.flow-status {
    margin-top: 4px;
    color: #1e8449;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: .8px;
    font-weight: 800;
}

.flow-arrow {
    align-self: center;
    width: 55px;
    position: relative;
    text-align: center;
    color: #71808e;
    font-size: 25px;
    font-weight: 800;
}

.flow-arrow:before {
    content: "";
    position: absolute;
    left: 4px;
    right: 4px;
    top: 50%;
    height: 2px;
    background: #c9d2db;
    z-index: 0;
}

.flow-arrow span {
    position: relative;
    z-index: 1;
    background: white;
    padding: 0 3px;
}


/* =========================================================
   ARCHITECTURE DIAGRAM
   ========================================================= */

.architecture-canvas {
    border-radius: 18px;
    background: #f7f9fb;
    border: 1px solid #e2e8ee;
    padding: 24px;
    overflow-x: auto;
}

.arch-flow {
    min-width: 1000px;
}

.arch-source {
    display: flex;
    justify-content: center;
    margin-bottom: 18px;
}

.arch-source-box {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 13px 22px;
    border-radius: 14px;
    background: #17202a;
    color: white;
    box-shadow: 0 6px 16px rgba(0,0,0,.12);
}

.arch-source-icon {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: #273746;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 900;
}

.arch-source-title {
    font-weight: 800;
}

.arch-source-sub {
    color: #b8c4cf;
    font-size: 11px;
    margin-top: 2px;
}

.arch-down {
    height: 28px;
    width: 2px;
    background: #aab7c4;
    margin: 0 auto;
}

.jenkins-box {
    width: 300px;
    margin: 0 auto;
    padding: 16px;
    text-align: center;
    border: 2px solid #a9cce3;
    background: #eaf2f8;
    border-radius: 15px;
}

.jenkins-title {
    font-weight: 900;
    color: #1b4f72;
}

.jenkins-sub {
    color: #5d6d7e;
    font-size: 11px;
    margin-top: 3px;
}

.arch-layers {
    display: grid;
    grid-template-columns: 1fr 1.15fr 1fr;
    gap: 16px;
    margin-top: 20px;
}

.arch-layer {
    padding: 18px;
    border-radius: 16px;
    border: 1px solid #dfe6ec;
    background: white;
}

.layer-title {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #71808e;
    font-weight: 900;
    margin-bottom: 14px;
    text-align: center;
}

.arch-nodes {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.arch-node {
    position: relative;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 11px;
    border-radius: 11px;
    border: 1px solid #dce4eb;
    background: #f9fafb;
}

.arch-node-icon {
    width: 35px;
    height: 35px;
    flex-shrink: 0;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #eaf2f8;
    color: #1b4f72;
    font-size: 12px;
    font-weight: 900;
}

.arch-node-name {
    font-weight: 800;
    font-size: 13px;
}

.arch-node-desc {
    margin-top: 2px;
    color: #82909d;
    font-size: 10px;
}

.arch-status {
    margin-left: auto;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: #1e8449;
}

.arch-connector {
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 12px 0;
    color: #8493a1;
    font-size: 12px;
    font-weight: 800;
}

.arch-footer {
    text-align: center;
    margin-top: 18px;
    color: #82909d;
    font-size: 11px;
}


/* =========================================================
   DEPLOYMENT STATUS
   ========================================================= */

.deployment {
    display: flex;
    align-items: center;
    gap: 18px;
    padding: 20px;
    border-radius: 15px;
    background: #eafaf1;
    border: 1px solid #a9dfbf;
}

.deployment.failed {
    background: #fdedec;
    border-color: #f1948a;
}

.deployment-icon {
    width: 50px;
    height: 50px;
    flex-shrink: 0;
    border-radius: 50%;
    background: #1e8449;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    font-weight: 900;
}

.deployment.failed .deployment-icon {
    background: #c0392b;
}

.deployment-title {
    font-size: 17px;
    font-weight: 900;
}

.deployment-description {
    color: #66737f;
    font-size: 12px;
    margin-top: 4px;
}


/* =========================================================
   SERVICE SUMMARY
   ========================================================= */

.summary-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin-bottom: 18px;
}

.summary-card {
    padding: 18px;
    border-radius: 14px;
    background: #f8fafc;
    border: 1px solid #e1e7ed;
}

.summary-number {
    font-size: 29px;
    font-weight: 900;
}

.summary-label {
    color: #82909d;
    font-size: 11px;
    margin-top: 3px;
}


/* =========================================================
   SERVICE CARDS
   ========================================================= */

.service-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 14px;
}

.service-card {
    padding: 18px;
    border-radius: 15px;
    border: 1px solid #e1e7ed;
    border-top: 4px solid #8493a1;
    background: white;
}

.service-card.healthy {
    border-top-color: #1e8449;
}

.service-card.running {
    border-top-color: #2471a3;
}

.service-card.starting {
    border-top-color: #b9770e;
}

.service-card.failed {
    border-top-color: #c0392b;
}

.service-card-top {
    display: flex;
    align-items: center;
    gap: 10px;
}

.service-pictogram {
    width: 38px;
    height: 38px;
    border-radius: 11px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    font-weight: 900;
    background: #f2f4f6;
}

.service-pictogram.healthy {
    background: #eafaf1;
    color: #1e8449;
}

.service-pictogram.running {
    background: #eaf2f8;
    color: #2471a3;
}

.service-pictogram.starting {
    background: #fef5e7;
    color: #b9770e;
}

.service-pictogram.failed {
    background: #fdedec;
    color: #c0392b;
}

.service-card-name {
    font-size: 15px;
    font-weight: 900;
    flex: 1;
}

.service-status-pill {
    padding: 5px 8px;
    border-radius: 20px;
    font-size: 9px;
    font-weight: 900;
    letter-spacing: .5px;
}

.service-status-pill.healthy {
    background: #eafaf1;
    color: #1e8449;
}

.service-status-pill.running {
    background: #eaf2f8;
    color: #2471a3;
}

.service-status-pill.starting {
    background: #fef5e7;
    color: #b9770e;
}

.service-status-pill.failed {
    background: #fdedec;
    color: #c0392b;
}

.service-detail {
    margin-top: 12px;
    font-size: 11px;
    color: #6c7a86;
}

.service-meta {
    margin-top: 13px;
    padding-top: 11px;
    border-top: 1px solid #edf0f3;
    display: grid;
    gap: 7px;
}

.service-meta div {
    display: flex;
    justify-content: space-between;
    gap: 12px;
}

.service-meta span {
    color: #9aa5ae;
    font-size: 10px;
}

.service-meta strong {
    max-width: 68%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: right;
    font-size: 10px;
}


/* =========================================================
   BUILD ACTIVITY
   ========================================================= */

.timeline {
    position: relative;
    margin-left: 10px;
    padding-left: 30px;
    border-left: 2px solid #dce3e9;
}

.timeline-item {
    position: relative;
    padding: 0 0 22px 12px;
}

.timeline-item:last-child {
    padding-bottom: 0;
}

.timeline-dot {
    position: absolute;
    left: -40px;
    top: 1px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #1e8449;
    border: 3px solid white;
    box-shadow: 0 0 0 2px #a9dfbf;
}

.timeline-title {
    font-size: 13px;
    font-weight: 900;
}

.timeline-description {
    color: #74818c;
    font-size: 11px;
    margin-top: 3px;
}

.timeline-code {
    display: inline-block;
    margin-top: 5px;
    padding: 4px 7px;
    border-radius: 5px;
    background: #f1f3f5;
    color: #566573;
    font-family: monospace;
    font-size: 10px;
}


/* =========================================================
   FOOTER
   ========================================================= */

.footer {
    text-align: center;
    padding: 18px;
    color: #8a969f;
    font-size: 11px;
}


/* =========================================================
   RESPONSIVE
   ========================================================= */

@media (max-width: 1100px) {

    .info-grid {
        grid-template-columns: repeat(2, 1fr);
    }

    .summary-grid {
        grid-template-columns: repeat(2, 1fr);
    }

    .service-grid {
        grid-template-columns: repeat(2, 1fr);
    }

    .arch-layers {
        grid-template-columns: 1fr;
    }
}

@media (max-width: 800px) {

    .container {
        padding: 14px;
    }

    .hero-row {
        flex-direction: column;
    }

    .flow {
        flex-direction: column;
        align-items: center;
    }

    .flow-node {
        width: 100%;
        max-width: 350px;
    }

    .flow-arrow {
        height: 35px;
        width: 35px;
        transform: rotate(90deg);
    }

    .info-grid,
    .summary-grid,
    .service-grid {
        grid-template-columns: 1fr;
    }
}

</style>
</head>


<body>

<div class="container">


<!-- =========================================================
     HERO
     ========================================================= -->

<div class="hero">

    <div class="hero-content">

        <div class="hero-row">

            <div>

                <div class="eyebrow">
                    E-Commerce DevOps Project
                </div>

                <h1>
                    CI/CD Control Center
                </h1>

                <div class="hero-description">
                    Jenkins → Docker Build → Deployment → Service Verification
                </div>

            </div>


            <div class="success-badge">

                <span class="success-dot"></span>

                BUILD #__BUILD_NUMBER__ • SUCCESS

            </div>

        </div>

    </div>

</div>


<!-- =========================================================
     BUILD INFORMATION
     ========================================================= -->

<div class="info-grid">

    <div class="info-card">

        <div class="info-label">
            Git Commit
        </div>

        <div class="info-value">
            __GIT_COMMIT__
        </div>

        <div class="info-sub">
            Source revision deployed by this build
        </div>

    </div>


    <div class="info-card">

        <div class="info-label">
            Git Branch
        </div>

        <div class="info-value">
            __GIT_BRANCH__
        </div>

        <div class="info-sub">
            Jenkins checkout source
        </div>

    </div>


    <div class="info-card">

        <div class="info-label">
            Build
        </div>

        <div class="info-value">
            #__BUILD_NUMBER__
        </div>

        <div class="info-sub">
            Jenkins pipeline execution
        </div>

    </div>


    <div class="info-card">

        <div class="info-label">
            Platform
        </div>

        <div class="info-value">
            Docker Compose
        </div>

        <div class="info-sub">
            __TOTAL_SERVICES__ services deployed
        </div>

    </div>

</div>


<!-- =========================================================
     CI/CD FLOW
     ========================================================= -->

<div class="section">

    <div class="section-heading">
        <div class="section-title">
            CI/CD Pipeline Flow
        </div>
    </div>

    <div class="section-subtitle">
        What happened to the committed code during this Jenkins build
    </div>


    <div class="flow">

        <div class="flow-node">

            <div class="flow-card">

                <div class="flow-icon">
                    G
                </div>

                <div class="flow-title">
                    GitHub
                </div>

                <div class="flow-status">
                    COMMIT __GIT_COMMIT__
                </div>

            </div>

        </div>


        <div class="flow-arrow">
            <span>→</span>
        </div>


        <div class="flow-node">

            <div class="flow-card">

                <div class="flow-icon">
                    J
                </div>

                <div class="flow-title">
                    Jenkins
                </div>

                <div class="flow-status">
                    BUILD #__BUILD_NUMBER__
                </div>

            </div>

        </div>


        <div class="flow-arrow">
            <span>→</span>
        </div>


        <div class="flow-node">

            <div class="flow-card">

                <div class="flow-icon">
                    ✓
                </div>

                <div class="flow-title">
                    Validate
                </div>

                <div class="flow-status">
                    COMPLETED
                </div>

            </div>

        </div>


        <div class="flow-arrow">
            <span>→</span>
        </div>


        <div class="flow-node">

            <div class="flow-card">

                <div class="flow-icon">
                    B
                </div>

                <div class="flow-title">
                    Docker Build
                </div>

                <div class="flow-status">
                    COMPLETED
                </div>

            </div>

        </div>


        <div class="flow-arrow">
            <span>→</span>
        </div>


        <div class="flow-node">

            <div class="flow-card">

                <div class="flow-icon">
                    D
                </div>

                <div class="flow-title">
                    Deploy
                </div>

                <div class="flow-status">
                    COMPLETED
                </div>

            </div>

        </div>


        <div class="flow-arrow">
            <span>→</span>
        </div>


        <div class="flow-node">

            <div class="flow-card">

                <div class="flow-icon">
                    ✓
                </div>

                <div class="flow-title">
                    Verify
                </div>

                <div class="flow-status">
                    __RUNNING_SERVICES__/__TOTAL_SERVICES__ RUNNING
                </div>

            </div>

        </div>

    </div>

</div>


<!-- =========================================================
     ARCHITECTURE
     ========================================================= -->

<div class="section">

    <div class="section-heading">
        <div class="section-title">
            E-Commerce Architecture
        </div>
    </div>

    <div class="section-subtitle">
        Visual topology of the application, data, messaging and observability layers
    </div>


    <div class="architecture-canvas">

        <div class="arch-flow">


            <!-- SOURCE -->

            <div class="arch-source">

                <div class="arch-source-box">

                    <div class="arch-source-icon">
                        G
                    </div>

                    <div>

                        <div class="arch-source-title">
                            GitHub
                        </div>

                        <div class="arch-source-sub">
                            Commit __GIT_COMMIT__
                        </div>

                    </div>

                </div>

            </div>


            <div class="arch-down"></div>


            <!-- JENKINS -->

            <div class="jenkins-box">

                <div class="jenkins-title">
                    Jenkins CI/CD
                </div>

                <div class="jenkins-sub">
                    Build #__BUILD_NUMBER__ → Docker Compose Deployment
                </div>

            </div>


            <div class="arch-down"></div>


            <!-- THREE LAYERS -->

            <div class="arch-layers">


                <!-- APPLICATION -->

                <div class="arch-layer">

                    <div class="layer-title">
                        Application Layer
                    </div>

                    <div class="arch-nodes">

                        <div class="arch-node">

                            <div class="arch-node-icon">
                                NG
                            </div>

                            <div>
                                <div class="arch-node-name">Nginx</div>
                                <div class="arch-node-desc">Reverse Proxy</div>
                            </div>

                            <div class="arch-status"></div>

                        </div>


                        <div class="arch-connector">
                            ↓ HTTP
                        </div>


                        <div class="arch-node">

                            <div class="arch-node-icon">
                                API
                            </div>

                            <div>
                                <div class="arch-node-name">Node / Express</div>
                                <div class="arch-node-desc">Backend API</div>
                            </div>

                            <div class="arch-status"></div>

                        </div>


                        <div class="arch-connector">
                            ↓
                        </div>


                        <div class="arch-node">

                            <div class="arch-node-icon">
                                UI
                            </div>

                            <div>
                                <div class="arch-node-name">React</div>
                                <div class="arch-node-desc">Frontend</div>
                            </div>

                            <div class="arch-status"></div>

                        </div>

                    </div>

                </div>


                <!-- DATA -->

                <div class="arch-layer">

                    <div class="layer-title">
                        Data & Messaging
                    </div>

                    <div class="arch-nodes">

                        <div class="arch-node">

                            <div class="arch-node-icon">
                                DB
                            </div>

                            <div>
                                <div class="arch-node-name">MySQL</div>
                                <div class="arch-node-desc">Application Database</div>
                            </div>

                            <div class="arch-status"></div>

                        </div>


                        <div class="arch-node">

                            <div class="arch-node-icon">
                                R
                            </div>

                            <div>
                                <div class="arch-node-name">Redis</div>
                                <div class="arch-node-desc">Cache Layer</div>
                            </div>

                            <div class="arch-status"></div>

                        </div>


                        <div class="arch-node">

                            <div class="arch-node-icon">
                                K
                            </div>

                            <div>
                                <div class="arch-node-name">Kafka</div>
                                <div class="arch-node-desc">Event Streaming</div>
                            </div>

                            <div class="arch-status"></div>

                        </div>


                        <div class="arch-node">

                            <div class="arch-node-icon">
                                DC
                            </div>

                            <div>
                                <div class="arch-node-name">Kafka Connect</div>
                                <div class="arch-node-desc">Debezium Integration</div>
                            </div>

                            <div class="arch-status"></div>

                        </div>

                    </div>

                </div>


                <!-- OBSERVABILITY -->

                <div class="arch-layer">

                    <div class="layer-title">
                        Observability
                    </div>

                    <div class="arch-nodes">

                        <div class="arch-node">

                            <div class="arch-node-icon">
                                P
                            </div>

                            <div>
                                <div class="arch-node-name">Prometheus</div>
                                <div class="arch-node-desc">Metrics Collection</div>
                            </div>

                            <div class="arch-status"></div>

                        </div>


                        <div class="arch-node">

                            <div class="arch-node-icon">
                                G
                            </div>

                            <div>
                                <div class="arch-node-name">Grafana</div>
                                <div class="arch-node-desc">Monitoring Dashboard</div>
                            </div>

                            <div class="arch-status"></div>

                        </div>


                        <div class="arch-node">

                            <div class="arch-node-icon">
                                CA
                            </div>

                            <div>
                                <div class="arch-node-name">cAdvisor</div>
                                <div class="arch-node-desc">Container Metrics</div>
                            </div>

                            <div class="arch-status"></div>

                        </div>

                    </div>

                </div>

            </div>


            <div class="arch-footer">
                All components above are deployed and managed through Docker Compose.
            </div>

        </div>

    </div>

</div>


<!-- =========================================================
     DEPLOYMENT STATUS
     ========================================================= -->

<div class="section">

    <div class="section-heading">
        <div class="section-title">
            Deployment Status
        </div>
    </div>

    <div class="deployment __DEPLOYMENT_CLASS__">

        <div class="deployment-icon">
            ✓
        </div>

        <div>

            <div class="deployment-title">
                __DEPLOYMENT_STATUS__
            </div>

            <div class="deployment-description">
                __DEPLOYMENT_DESCRIPTION__
            </div>

        </div>

    </div>

</div>


<!-- =========================================================
     SERVICE HEALTH
     ========================================================= -->

<div class="section">

    <div class="section-heading">
        <div class="section-title">
            Service Health
        </div>
    </div>

    <div class="section-subtitle">
        Live Docker Compose state captured after deployment verification
    </div>


    <div class="summary-grid">

        <div class="summary-card">
            <div class="summary-number">
                __TOTAL_SERVICES__
            </div>
            <div class="summary-label">
                Total Services
            </div>
        </div>


        <div class="summary-card">
            <div class="summary-number">
                __HEALTHY_SERVICES__
            </div>
            <div class="summary-label">
                Healthchecks Passing
            </div>
        </div>


        <div class="summary-card">
            <div class="summary-number">
                __RUNNING_SERVICES__
            </div>
            <div class="summary-label">
                Running
            </div>
        </div>


        <div class="summary-card">
            <div class="summary-number">
                __FAILED_SERVICES__
            </div>
            <div class="summary-label">
                Failed
            </div>
        </div>

    </div>


    <div class="service-grid">

__SERVICE_CARDS__

    </div>

</div>


<!-- =========================================================
     BUILD ACTIVITY
     ========================================================= -->

<div class="section">

    <div class="section-heading">
        <div class="section-title">
            Build Activity
        </div>
    </div>

    <div class="section-subtitle">
        Build #__BUILD_NUMBER__ execution summary
    </div>


    <div class="timeline">


        <div class="timeline-item">

            <div class="timeline-dot"></div>

            <div class="timeline-title">
                01 · Source Checkout
            </div>

            <div class="timeline-description">
                Jenkins checked out the source revision used for this deployment.
            </div>

            <div class="timeline-code">
                Commit __GIT_COMMIT__
            </div>

        </div>


        <div class="timeline-item">

            <div class="timeline-dot"></div>

            <div class="timeline-title">
                02 · Project Validation
            </div>

            <div class="timeline-description">
                Project files and Docker Compose configuration were validated successfully.
            </div>

            <div class="timeline-code">
                docker compose config --quiet
            </div>

        </div>


        <div class="timeline-item">

            <div class="timeline-dot"></div>

            <div class="timeline-title">
                03 · Docker Image Build
            </div>

            <div class="timeline-description">
                Backend, Nginx and Prometheus application-owned images were built.
            </div>

            <div class="timeline-code">
                docker compose build
            </div>

        </div>


        <div class="timeline-item">

            <div class="timeline-dot"></div>

            <div class="timeline-title">
                04 · Infrastructure Images
            </div>

            <div class="timeline-description">
                MySQL, Redis, Kafka, Kafka Connect, Grafana and cAdvisor images were pulled.
            </div>

            <div class="timeline-code">
                docker compose pull
            </div>

        </div>


        <div class="timeline-item">

            <div class="timeline-dot"></div>

            <div class="timeline-title">
                05 · Deployment
            </div>

            <div class="timeline-description">
                Docker Compose started or updated the E-Commerce platform services.
            </div>

            <div class="timeline-code">
                docker compose up -d
            </div>

        </div>


        <div class="timeline-item">

            <div class="timeline-dot"></div>

            <div class="timeline-title">
                06 · Service Verification
            </div>

            <div class="timeline-description">
                Jenkins verified Docker container state and healthcheck results.
            </div>

            <div class="timeline-code">
                __RUNNING_SERVICES__/__TOTAL_SERVICES__ running
            </div>

        </div>


        <div class="timeline-item">

            <div class="timeline-dot"></div>

            <div class="timeline-title">
                07 · Deployment Confirmed
            </div>

            <div class="timeline-description">
                The deployment completed successfully and the dashboard was generated automatically.
            </div>

            <div class="timeline-code">
                __DEPLOYMENT_STATUS__
            </div>

        </div>


    </div>

</div>


<div class="footer">

    Generated automatically by Jenkins
    • E-Commerce DevOps Project
    • Build #__BUILD_NUMBER__
    • __GENERATED__

</div>


</div>

</body>
</html>
HTML_TEMPLATE


                    # -------------------------------------------------
                    # INJECT SCALAR VALUES
                    # -------------------------------------------------
                    sed \
                        -e "s|__BUILD_NUMBER__|${build_number}|g" \
                        -e "s|__GENERATED__|${generated}|g" \
                        -e "s|__GIT_BRANCH__|${git_branch}|g" \
                        -e "s|__GIT_COMMIT__|${git_commit}|g" \
                        -e "s|__TOTAL_SERVICES__|${total_services}|g" \
                        -e "s|__HEALTHY_SERVICES__|${healthy_services}|g" \
                        -e "s|__RUNNING_SERVICES__|${running_services}|g" \
                        -e "s|__STARTING_SERVICES__|${starting_services}|g" \
                        -e "s|__FAILED_SERVICES__|${failed_services}|g" \
                        -e "s|__DEPLOYMENT_CLASS__|${deployment_class}|g" \
                        -e "s|__DEPLOYMENT_STATUS__|${deployment_status}|g" \
                        -e "s|__DEPLOYMENT_DESCRIPTION__|${deployment_description}|g" \
                        dashboard/index.template.html \
                        > dashboard/index.html


                    # -------------------------------------------------
                    # INSERT SERVICE CARDS
                    #
                    # Do NOT pass multiline HTML through awk -v.
                    # awk reads the service_cards file directly.
                    # -------------------------------------------------
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


                    # -------------------------------------------------
                    # CLEAN TEMPORARY FILES
                    # -------------------------------------------------
                    rm -f dashboard/index.template.html
                    rm -f dashboard/service_cards.html


                    # -------------------------------------------------
                    # VALIDATE DASHBOARD
                    # -------------------------------------------------
                    test -s dashboard/index.html

                    grep -q "CI/CD Control Center" dashboard/index.html
                    grep -q "CI/CD Pipeline Flow" dashboard/index.html
                    grep -q "E-Commerce Architecture" dashboard/index.html
                    grep -q "Service Health" dashboard/index.html
                    grep -q "Build Activity" dashboard/index.html
                    grep -q "backend" dashboard/index.html
                    grep -q "mysql" dashboard/index.html
                    grep -q "grafana" dashboard/index.html


                    echo ""
                    echo "========================================="
                    echo "Architecture dashboard generated"
                    echo "========================================="

                    echo "Build: #${build_number}"
                    echo "Git commit: ${git_commit}"
                    echo "Git branch: ${git_branch}"
                    echo "Deployment: ${deployment_status}"
                    echo "Total services: ${total_services}"
                    echo "Healthy services: ${healthy_services}"
                    echo "Running services: ${running_services}"
                    echo "Starting services: ${starting_services}"
                    echo "Failed services: ${failed_services}"

                    echo ""
                    echo "Dashboard file:"
                    ls -lh dashboard/index.html

                    echo ""
                    echo "Dashboard validation passed"
                '''
            }
        }
    }


    // =============================================================
    // POST ACTIONS
    // =============================================================
    post {

        always {

            echo '========================================='
            echo 'Pipeline Summary'
            echo '========================================='


            sh '''
                echo "Docker Compose service summary:"

                docker compose ps \
                    --format "{{.Service}}|{{.State}}|{{.Health}}" \
                    || true
            '''


            script {

                if (fileExists('dashboard/index.html')) {

                    echo 'Publishing architecture dashboard'


                    publishHTML(target: [

                        allowMissing: true,

                        alwaysLinkToLastBuild: true,

                        keepAll: true,

                        reportDir: 'dashboard',

                        reportFiles: 'index.html',

                        reportName:
                            'E-Commerce Architecture Dashboard'

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

    }

}
