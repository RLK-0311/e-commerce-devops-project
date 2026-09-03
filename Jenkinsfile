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
