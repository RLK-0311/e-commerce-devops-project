pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
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
    }

    post {

        success {
            echo '========================================='
            echo 'E-Commerce CI pipeline completed successfully'
            echo '========================================='
        }

        failure {
            echo '========================================='
            echo 'E-Commerce CI pipeline failed'
            echo '========================================='
        }

        always {
            echo 'Docker CI pipeline finished'
        }
    }
}
