pipeline {
    agent any

    environment {
        COMPOSE_PROJECT_NAME = 'ecommerce-platform'
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
                    echo "Generating Architecture Dashboard"
                    echo "========================================="

                    mkdir -p dashboard

                    generated=$(date '+%Y-%m-%d %H:%M:%S')

                    services="backend mysql redis kafka kafka-connect nginx prometheus grafana cadvisor"

                    html_rows=""


                    # -------------------------------------------------
                    # COLLECT LIVE DOCKER SERVICE STATUS
                    # -------------------------------------------------
                    for service in $services; do

                        container_id=$(docker compose ps -q "$service" 2>/dev/null || true)


                        if [ -z "$container_id" ]; then

                            status="FAILED"
                            detail="container not found"

                        else

                            state=$(docker inspect \
                                -f '{{.State.Status}}' \
                                "$container_id" \
                                2>/dev/null || echo "unknown")


                            health=$(docker inspect \
                                -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' \
                                "$container_id" \
                                2>/dev/null || echo "unknown")


                            if [ "$state" = "running" ] && \
                               [ "$health" = "healthy" ]; then

                                status="HEALTHY"
                                detail="running + healthy"

                            elif [ "$state" = "running" ] && \
                                 [ "$health" = "none" ]; then

                                status="RUNNING"
                                detail="running without healthcheck"

                            elif [ "$state" = "running" ] && \
                                 [ "$health" = "starting" ]; then

                                status="STARTING"
                                detail="healthcheck still starting"

                            else

                                status="FAILED"
                                detail="state=$state, health=$health"

                            fi

                        fi


                        case "$status" in

                            HEALTHY)
                                status_class="healthy"
                                ;;

                            RUNNING)
                                status_class="running"
                                ;;

                            STARTING)
                                status_class="starting"
                                ;;

                            *)
                                status_class="failed"
                                ;;

                        esac


                        html_rows="${html_rows}
                        <tr>
                            <td>${service}</td>
                            <td class=\"${status_class}\">${status}</td>
                            <td>${detail}</td>
                        </tr>"

                    done


                    # -------------------------------------------------
                    # GENERATE HTML DASHBOARD
                    # -------------------------------------------------
                    cat > dashboard/index.html <<EOF
<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">

<meta name="viewport"
      content="width=device-width, initial-scale=1.0">

<title>E-Commerce CI/CD Architecture</title>


<style>

* {
    box-sizing: border-box;
}


body {
    font-family: Arial, sans-serif;
    background: #f4f6f8;
    margin: 0;
    padding: 30px;
    color: #17202a;
}


.container {
    max-width: 1200px;
    margin: auto;
}


h1 {
    margin-bottom: 5px;
}


.subtitle {
    color: #5f6b76;
    margin-bottom: 25px;
}


.flow {
    display: flex;
    flex-direction: column;
    gap: 14px;
}


.layer {
    background: white;
    border-radius: 12px;
    padding: 18px;
    box-shadow: 0 2px 8px rgba(0,0,0,.08);
}


.layer-title {
    font-weight: bold;
    font-size: 16px;
    margin-bottom: 12px;
}


.nodes {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
}


.node {
    padding: 12px 16px;
    border-radius: 8px;
    background: #eaf2f8;
    border: 1px solid #ccd6dd;
    min-width: 130px;
    text-align: center;
}


.source {
    font-weight: bold;
    color: #566573;
}


table {
    width: 100%;
    border-collapse: collapse;
    background: white;
    margin-top: 25px;
    border-radius: 10px;
    overflow: hidden;
}


th,
td {
    padding: 12px;
    border-bottom: 1px solid #e5e7e9;
    text-align: left;
}


th {
    background: #17202a;
    color: white;
}


.healthy {
    color: #1e8449;
    font-weight: bold;
}


.running {
    color: #2471a3;
    font-weight: bold;
}


.starting {
    color: #b9770e;
    font-weight: bold;
}


.failed {
    color: #c0392b;
    font-weight: bold;
}


.pipeline-info {
    margin-top: 25px;

    display: grid;

    grid-template-columns:
        repeat(auto-fit, minmax(200px, 1fr));

    gap: 12px;
}


.info-card {
    background: white;
    padding: 16px;
    border-radius: 10px;
    box-shadow: 0 2px 8px rgba(0,0,0,.08);
}


.info-title {
    font-size: 12px;
    color: #7b8794;
    text-transform: uppercase;
    margin-bottom: 6px;
}


.info-value {
    font-size: 18px;
    font-weight: bold;
}


@media (max-width: 700px) {

    body {
        padding: 15px;
    }


    .node {
        width: 100%;
    }

}

</style>

</head>


<body>


<div class="container">


<h1>
    E-Commerce CI/CD Architecture
</h1>


<div class="subtitle">
    Generated by Jenkins • ${generated}
</div>


<!-- ========================================================= -->
<!-- PIPELINE INFORMATION -->
<!-- ========================================================= -->

<div class="pipeline-info">


<div class="info-card">

<div class="info-title">
    CI/CD
</div>

<div class="info-value">
    Jenkins
</div>

</div>


<div class="info-card">

<div class="info-title">
    Container Platform
</div>

<div class="info-value">
    Docker Compose
</div>

</div>


<div class="info-card">

<div class="info-title">
    Source Control
</div>

<div class="info-value">
    GitHub
</div>

</div>


<div class="info-card">

<div class="info-title">
    Environment
</div>

<div class="info-value">
    E-Commerce Platform
</div>

</div>


</div>


<!-- ========================================================= -->
<!-- ARCHITECTURE -->
<!-- ========================================================= -->

<div class="flow">


<div class="layer">

<div class="layer-title">
    Source
</div>

<div class="nodes">

<div class="node source">
    GitHub
</div>

</div>

</div>


<div class="layer">

<div class="layer-title">
    Frontend
</div>

<div class="nodes">

<div class="node source">
    React
</div>

</div>

</div>


<div class="layer">

<div class="layer-title">
    Application
</div>

<div class="nodes">

<div class="node">
    Nginx
</div>

<div class="node">
    Node / Express Backend
</div>

</div>

</div>


<div class="layer">

<div class="layer-title">
    Data &amp; Messaging
</div>

<div class="nodes">

<div class="node">
    MySQL
</div>

<div class="node">
    Redis
</div>

<div class="node">
    Kafka
</div>

<div class="node">
    Kafka Connect
</div>

</div>

</div>


<div class="layer">

<div class="layer-title">
    Monitoring
</div>

<div class="nodes">

<div class="node">
    Prometheus
</div>

<div class="node">
    Grafana
</div>

<div class="node">
    cAdvisor
</div>

</div>

</div>


</div>


<!-- ========================================================= -->
<!-- LIVE STATUS -->
<!-- ========================================================= -->

<h2>
    Live Docker Service Status
</h2>


<table>


<tr>

<th>
    Service
</th>

<th>
    Status
</th>

<th>
    Details
</th>

</tr>


${html_rows}


</table>


</div>


</body>

</html>
EOF


                    echo ""
                    echo "Architecture dashboard generated successfully:"
                    echo "dashboard/index.html"

                    echo ""
                    echo "Dashboard file:"
                    ls -lh dashboard/index.html
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
