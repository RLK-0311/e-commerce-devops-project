pipeline {
    agent any

    stages {

        stage('Checkout') {
            steps {
                echo 'Source code checkout completed by Jenkins'
            }
        }

        stage('Validate Project') {
            steps {
                sh '''
                    echo "Validating project structure..."

                    test -f docker-compose.yml
                    test -d backend
                    test -d frontend

                    echo "Project structure validation passed"
                '''
            }
        }

        stage('Validate Docker Compose') {
            steps {
                sh '''
                    echo "Validating Docker Compose configuration..."

                    docker compose config --quiet

                    echo "Docker Compose configuration is valid"
                '''
            }
        }

        stage('Build Docker Images') {
            steps {
                sh '''
                    echo "Building Docker images..."

                    docker compose build

                    echo "Docker image build completed successfully"
                '''
            }
        }
    }

    post {
        success {
            echo 'E-Commerce CI pipeline completed successfully'
        }

        failure {
            echo 'E-Commerce CI pipeline failed'
        }
    }
}
