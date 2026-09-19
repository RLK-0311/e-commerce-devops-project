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
                checkout scm

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

                // -------------------------------------------------
                // BUILD LOCAL APPLICATION IMAGES
                // -------------------------------------------------
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


                // -------------------------------------------------
                // PULL EXTERNAL INFRASTRUCTURE IMAGES
                // -------------------------------------------------
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


                        # -------------------------------------------------
                        # SUCCESS
                        # -------------------------------------------------
                        if [ "$failed" -eq 0 ] && [ "$starting" -eq 0 ]; then

                            echo "========================================="
                            echo "All required Docker services are healthy/running."
                            echo "========================================="

                            exit 0

                        fi


                        # -------------------------------------------------
                        # ACTUAL FAILURE
                        # -------------------------------------------------
                        if [ "$failed" -eq 1 ] && [ "$starting" -eq 0 ]; then

                            echo "========================================="
                            echo "One or more services failed verification."
                            echo "========================================="

                            exit 1

                        fi


                        # -------------------------------------------------
                        # STILL STARTING
                        # -------------------------------------------------
                        echo "Some services are still starting."
                        echo "Waiting 5 seconds before checking again..."

                        sleep 5

                        attempt=$((attempt + 1))

                    done


                    # -----------------------------------------------------
                    # TIMEOUT
                    # -----------------------------------------------------
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
        // GENERATE ARCHITECTURE DASHBOARD
        // =========================================================
        stage('Generate Architecture Dashboard') {
            steps {
                sh '''
                    set -e

                    echo "========================================="
                    echo "Generating E-Commerce CI/CD Dashboard"
                    echo "========================================="

                    mkdir -p dashboard


                    # -------------------------------------------------
                    # BUILD INFORMATION
                    # -------------------------------------------------
                    generated=$(date '+%Y-%m-%d %H:%M:%S')

                    build_number="${BUILD_NUMBER:-N/A}"

                    git_commit=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

                    if [ -n "${BRANCH_NAME:-}" ]; then
                        git_branch="${BRANCH_NAME}"
                    else
                        git_branch=$(git symbolic-ref --short -q HEAD 2>/dev/null || echo "detached")
                    fi


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
                    # CREATE SERVICE CARDS FILE
                    #
                    # This is deliberately generated separately from
                    # the HTML template so Bash never interprets the
                    # HTML/CSS as shell commands.
                    # -------------------------------------------------
                    : > dashboard/service_cards.html


                    for service in $services; do

                        total_services=$((total_services + 1))

                        container_id=$(docker compose ps -q "$service" 2>/dev/null || true)


                        if [ -z "$container_id" ]; then

                            status="FAILED"
                            detail="Container not found"
                            status_class="failed"
                            status_icon="&#10060;"
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
                                status_icon="&#10003;"

                                healthy_services=$((healthy_services + 1))
                                running_services=$((running_services + 1))

                            elif [ "$state" = "running" ] && \
                                 [ "$health" = "none" ]; then

                                status="RUNNING"
                                detail="Running without healthcheck"
                                status_class="running"
                                status_icon="&#9679;"

                                running_services=$((running_services + 1))

                            elif [ "$state" = "running" ] && \
                                 [ "$health" = "starting" ]; then

                                status="STARTING"
                                detail="Healthcheck still starting"
                                status_class="starting"
                                status_icon="&#9688;"

                                starting_services=$((starting_services + 1))
                                running_services=$((running_services + 1))

                            else

                                status="FAILED"
                                detail="State: $state | Health: $health"
                                status_class="failed"
                                status_icon="&#10060;"

                                failed_services=$((failed_services + 1))

                            fi

                        fi


                        # -------------------------------------------------
                        # Append HTML safely to a separate file.
                        # Quoted EOF prevents shell interpretation.
                        # -------------------------------------------------
                        cat >> dashboard/service_cards.html <<EOF
<div class="service-card ${status_class}">

    <div class="service-header">

        <div class="service-name">
            ${service}
        </div>

        <div class="status-icon">
            ${status_icon}
        </div>

    </div>

    <div class="service-status ${status_class}">
        ${status}
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
                    # OVERALL DEPLOYMENT STATUS
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
                    # PIPELINE STATUS
                    # -------------------------------------------------
                    pipeline_status="SUCCESS"


                    # -------------------------------------------------
                    # GENERATE COMPLETE HTML
                    #
                    # IMPORTANT:
                    # The HTML template is single-quoted heredoc.
                    # Bash therefore does NOT interpret CSS, HTML,
                    # JavaScript, ${...}, or special characters.
                    # -------------------------------------------------
                    cat > dashboard/index.template.html <<'HTML_TEMPLATE'
<!DOCTYPE html>

<html lang="en">

<head>

<meta charset="UTF-8">

<meta name="viewport"
      content="width=device-width, initial-scale=1.0">

<title>E-Commerce CI/CD Dashboard</title>


<style>

* {
    box-sizing: border-box;
}


body {
    margin: 0;
    padding: 0;

    font-family:
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        Arial,
        sans-serif;

    background: #f3f5f8;

    color: #17202a;
}


.container {
    max-width: 1400px;

    margin: auto;

    padding: 30px;
}


/* =========================================================
   HEADER
   ========================================================= */

.header {
    background: linear-gradient(
        135deg,
        #17202a,
        #273746
    );

    color: white;

    padding: 30px;

    border-radius: 16px;

    margin-bottom: 20px;

    box-shadow:
        0 8px 24px rgba(0,0,0,.12);
}


.header-top {
    display: flex;

    justify-content: space-between;

    align-items: flex-start;

    gap: 20px;
}


.header h1 {
    margin: 0 0 8px 0;

    font-size: 30px;
}


.header-subtitle {
    color: #ccd1d1;

    font-size: 14px;
}


.build-badge {
    background: #1e8449;

    padding: 10px 16px;

    border-radius: 20px;

    font-weight: bold;

    white-space: nowrap;
}


/* =========================================================
   INFO CARDS
   ========================================================= */

.info-grid {
    display: grid;

    grid-template-columns:
        repeat(auto-fit, minmax(180px, 1fr));

    gap: 15px;

    margin-bottom: 20px;
}


.info-card {
    background: white;

    padding: 20px;

    border-radius: 12px;

    box-shadow:
        0 3px 12px rgba(0,0,0,.07);
}


.info-label {
    font-size: 11px;

    color: #7b8794;

    text-transform: uppercase;

    letter-spacing: .8px;

    margin-bottom: 8px;
}


.info-value {
    font-size: 20px;

    font-weight: 700;

    word-break: break-word;
}


.info-small {
    margin-top: 5px;

    color: #7b8794;

    font-size: 12px;
}


/* =========================================================
   SECTION
   ========================================================= */

.section {
    background: white;

    border-radius: 14px;

    padding: 24px;

    margin-bottom: 20px;

    box-shadow:
        0 3px 12px rgba(0,0,0,.07);
}


.section-title {
    font-size: 20px;

    font-weight: 700;

    margin-bottom: 20px;
}


.section-subtitle {
    color: #7b8794;

    font-size: 13px;

    margin-top: -12px;

    margin-bottom: 20px;
}


/* =========================================================
   PIPELINE
   ========================================================= */

.pipeline {
    display: flex;

    align-items: center;

    justify-content: center;

    flex-wrap: wrap;

    gap: 8px;
}


.pipeline-stage {
    min-width: 145px;

    padding: 15px;

    border-radius: 10px;

    text-align: center;

    border: 1px solid #d5d8dc;

    background: #f8f9f9;
}


.pipeline-stage.completed {
    border-color: #82e0aa;

    background: #eafaf1;
}


.stage-number {
    width: 28px;

    height: 28px;

    line-height: 28px;

    margin: auto auto 8px auto;

    border-radius: 50%;

    background: #1e8449;

    color: white;

    font-weight: bold;
}


.stage-name {
    font-weight: bold;

    font-size: 14px;
}


.stage-state {
    margin-top: 4px;

    font-size: 11px;

    color: #1e8449;

    text-transform: uppercase;
}


.pipeline-arrow {
    font-size: 24px;

    color: #85929e;

    font-weight: bold;
}


/* =========================================================
   ARCHITECTURE
   ========================================================= */

.architecture {
    display: flex;

    flex-direction: column;

    gap: 12px;
}


.arch-layer {
    border: 1px solid #e5e7e9;

    border-radius: 12px;

    padding: 18px;

    background: #fafbfc;
}


.arch-title {
    font-size: 12px;

    text-transform: uppercase;

    letter-spacing: 1px;

    color: #7b8794;

    margin-bottom: 12px;

    font-weight: bold;
}


.arch-nodes {
    display: flex;

    flex-wrap: wrap;

    gap: 10px;
}


.arch-node {
    background: white;

    border: 1px solid #ccd1d1;

    padding: 12px 18px;

    border-radius: 9px;

    font-weight: 600;

    box-shadow:
        0 2px 5px rgba(0,0,0,.04);
}


.arch-node.primary {
    background: #eaf2f8;

    border-color: #a9cce3;
}


/* =========================================================
   DEPLOYMENT STATUS
   ========================================================= */

.deployment-status {
    display: flex;

    align-items: center;

    gap: 15px;

    padding: 18px;

    border-radius: 10px;

    background: #eafaf1;

    border: 1px solid #a9dfbf;
}


.deployment-status.failed {
    background: #fdedec;

    border-color: #f1948a;
}


.deployment-dot {
    width: 15px;

    height: 15px;

    border-radius: 50%;

    background: #1e8449;
}


.deployment-status.failed .deployment-dot {
    background: #c0392b;
}


.deployment-title {
    font-weight: 800;
}


.deployment-description {
    color: #626567;

    font-size: 12px;

    margin-top: 3px;
}


/* =========================================================
   SERVICE SUMMARY
   ========================================================= */

.summary-grid {
    display: grid;

    grid-template-columns:
        repeat(auto-fit, minmax(160px, 1fr));

    gap: 12px;

    margin-bottom: 20px;
}


.summary-card {
    padding: 18px;

    border-radius: 10px;

    background: #f8f9f9;

    border: 1px solid #e5e7e9;
}


.summary-number {
    font-size: 28px;

    font-weight: 800;
}


.summary-label {
    font-size: 12px;

    color: #7b8794;

    margin-top: 3px;
}


/* =========================================================
   SERVICE CARDS
   ========================================================= */

.service-grid {
    display: grid;

    grid-template-columns:
        repeat(auto-fit, minmax(280px, 1fr));

    gap: 15px;
}


.service-card {
    background: white;

    border: 1px solid #e5e7e9;

    border-left: 5px solid #85929e;

    border-radius: 12px;

    padding: 18px;

    box-shadow:
        0 2px 8px rgba(0,0,0,.05);
}


.service-card.healthy {
    border-left-color: #1e8449;
}


.service-card.running {
    border-left-color: #2471a3;
}


.service-card.starting {
    border-left-color: #b9770e;
}


.service-card.failed {
    border-left-color: #c0392b;
}


.service-header {
    display: flex;

    justify-content: space-between;

    align-items: center;
}


.service-name {
    font-size: 17px;

    font-weight: 700;
}


.status-icon {
    font-size: 22px;

    font-weight: bold;
}


.service-status {
    margin-top: 10px;

    font-size: 12px;

    font-weight: 800;

    letter-spacing: .7px;
}


.service-status.healthy {
    color: #1e8449;
}


.service-status.running {
    color: #2471a3;
}


.service-status.starting {
    color: #b9770e;
}


.service-status.failed {
    color: #c0392b;
}


.service-detail {
    margin-top: 6px;

    font-size: 12px;

    color: #626567;
}


.service-meta {
    margin-top: 15px;

    padding-top: 12px;

    border-top: 1px solid #f0f1f1;

    display: grid;

    gap: 8px;
}


.service-meta div {
    display: flex;

    justify-content: space-between;

    gap: 15px;

    font-size: 11px;
}


.service-meta span {
    color: #909497;
}


.service-meta strong {
    max-width: 65%;

    text-align: right;

    overflow: hidden;

    text-overflow: ellipsis;

    white-space: nowrap;
}


/* =========================================================
   FOOTER
   ========================================================= */

.footer {
    text-align: center;

    color: #909497;

    font-size: 12px;

    padding: 15px;
}


/* =========================================================
   RESPONSIVE
   ========================================================= */

@media (max-width: 800px) {

    .container {
        padding: 15px;
    }


    .header-top {
        flex-direction: column;
    }


    .pipeline-arrow {
        transform: rotate(90deg);
    }


    .pipeline {
        flex-direction: column;
    }


    .pipeline-stage {
        width: 100%;
    }

}

</style>

</head>


<body>


<div class="container">


<!-- =========================================================
     HEADER
     ========================================================= -->

<div class="header">

    <div class="header-top">

        <div>

            <h1>
                E-Commerce CI/CD Dashboard
            </h1>

            <div class="header-subtitle">
                Jenkins → Docker Build → Deployment → Service Verification
            </div>

        </div>


        <div class="build-badge">
            BUILD #__BUILD_NUMBER__
        </div>

    </div>

</div>


<!-- =========================================================
     BUILD INFORMATION
     ========================================================= -->

<div class="info-grid">


    <div class="info-card">

        <div class="info-label">
            Pipeline
        </div>

        <div class="info-value">
            Jenkins
        </div>

        <div class="info-small">
            CI/CD Automation
        </div>

    </div>


    <div class="info-card">

        <div class="info-label">
            Build
        </div>

        <div class="info-value">
            #__BUILD_NUMBER__
        </div>

        <div class="info-small">
            __GENERATED__
        </div>

    </div>


    <div class="info-card">

        <div class="info-label">
            Git Branch
        </div>

        <div class="info-value">
            __GIT_BRANCH__
        </div>

        <div class="info-small">
            Commit __GIT_COMMIT__
        </div>

    </div>


    <div class="info-card">

        <div class="info-label">
            Container Platform
        </div>

        <div class="info-value">
            Docker Compose
        </div>

        <div class="info-small">
            __TOTAL_SERVICES__ services
        </div>

    </div>


</div>


<!-- =========================================================
     CI/CD PIPELINE
     ========================================================= -->

<div class="section">

    <div class="section-title">
        CI/CD Pipeline
    </div>

    <div class="section-subtitle">
        Jenkins pipeline execution flow
    </div>


    <div class="pipeline">


        <div class="pipeline-stage completed">

            <div class="stage-number">
                1
            </div>

            <div class="stage-name">
                Checkout
            </div>

            <div class="stage-state">
                Completed
            </div>

        </div>


        <div class="pipeline-arrow">
            →
        </div>


        <div class="pipeline-stage completed">

            <div class="stage-number">
                2
            </div>

            <div class="stage-name">
                Validate
            </div>

            <div class="stage-state">
                Completed
            </div>

        </div>


        <div class="pipeline-arrow">
            →
        </div>


        <div class="pipeline-stage completed">

            <div class="stage-number">
                3
            </div>

            <div class="stage-name">
                Build
            </div>

            <div class="stage-state">
                Completed
            </div>

        </div>


        <div class="pipeline-arrow">
            →
        </div>


        <div class="pipeline-stage completed">

            <div class="stage-number">
                4
            </div>

            <div class="stage-name">
                Deploy
            </div>

            <div class="stage-state">
                Completed
            </div>

        </div>


        <div class="pipeline-arrow">
            →
        </div>


        <div class="pipeline-stage completed">

            <div class="stage-number">
                5
            </div>

            <div class="stage-name">
                Verify
            </div>

            <div class="stage-state">
                Completed
            </div>

        </div>


    </div>

</div>


<!-- =========================================================
     ARCHITECTURE
     ========================================================= -->

<div class="section">

    <div class="section-title">
        E-Commerce Architecture
    </div>

    <div class="section-subtitle">
        Application and infrastructure topology
    </div>


    <div class="architecture">


        <div class="arch-layer">

            <div class="arch-title">
                Source Control
            </div>

            <div class="arch-nodes">

                <div class="arch-node primary">
                    GitHub
                </div>

            </div>

        </div>


        <div class="arch-layer">

            <div class="arch-title">
                Frontend
            </div>

            <div class="arch-nodes">

                <div class="arch-node primary">
                    React
                </div>

            </div>

        </div>


        <div class="arch-layer">

            <div class="arch-title">
                Application Layer
            </div>

            <div class="arch-nodes">

                <div class="arch-node">
                    Nginx
                </div>

                <div class="arch-node">
                    Node / Express Backend
                </div>

            </div>

        </div>


        <div class="arch-layer">

            <div class="arch-title">
                Data &amp; Messaging
            </div>

            <div class="arch-nodes">

                <div class="arch-node">
                    MySQL
                </div>

                <div class="arch-node">
                    Redis
                </div>

                <div class="arch-node">
                    Kafka
                </div>

                <div class="arch-node">
                    Kafka Connect
                </div>

            </div>

        </div>


        <div class="arch-layer">

            <div class="arch-title">
                Observability
            </div>

            <div class="arch-nodes">

                <div class="arch-node">
                    Prometheus
                </div>

                <div class="arch-node">
                    Grafana
                </div>

                <div class="arch-node">
                    cAdvisor
                </div>

            </div>

        </div>


    </div>

</div>


<!-- =========================================================
     DEPLOYMENT STATUS
     ========================================================= -->

<div class="section">

    <div class="section-title">
        Deployment Status
    </div>


    <div class="deployment-status __DEPLOYMENT_CLASS__">

        <div class="deployment-dot"></div>

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
     SERVICE SUMMARY
     ========================================================= -->

<div class="section">

    <div class="section-title">
        Service Health Summary
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
                Healthy
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
                __STARTING_SERVICES__
            </div>

            <div class="summary-label">
                Starting
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
     FOOTER
     ========================================================= -->

<div class="footer">

    Generated automatically by Jenkins •
    E-Commerce DevOps Project •
    __GENERATED__

</div>


</div>


</body>

</html>
HTML_TEMPLATE


                    # -------------------------------------------------
                    # INJECT DYNAMIC VALUES
                    # -------------------------------------------------
                    service_cards=$(cat dashboard/service_cards.html)

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
                        dashboard/index.template.html > dashboard/index.html


                    # -------------------------------------------------
                    # INSERT SERVICE CARDS
                    # -------------------------------------------------
                    awk -v cards="$service_cards" '
                        {
                            if ($0 == "__SERVICE_CARDS__") {
                                printf "%s\\n", cards
                            } else {
                                print
                            }
                        }
                    ' dashboard/index.html > dashboard/index.final.html


                    mv dashboard/index.final.html dashboard/index.html


                    # -------------------------------------------------
                    # CLEAN TEMPLATE FILE
                    # -------------------------------------------------
                    rm -f dashboard/index.template.html
                    rm -f dashboard/service_cards.html


                    # -------------------------------------------------
                    # VALIDATE GENERATED HTML
                    # -------------------------------------------------
                    test -s dashboard/index.html

                    grep -q "E-Commerce CI/CD Dashboard" dashboard/index.html
                    grep -q "Service Health Summary" dashboard/index.html
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
