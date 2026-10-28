
pipeline {
    agent any

    stages {
        stage('Check Environment') {
            steps {
                sh 'docker --version'
            }
        }

        stage('Install Dependencies and Test') {
            steps {
                sh '''
                    docker run --rm \
                      -v "$WORKSPACE:/app" \
                      -w /app \
                      node:20 \
                      sh -c "npm install && npm test"
                '''
            }
        }

        stage('Build Docker Image') {
            steps {
                sh 'docker build -t student-attendance:1.0 .'
            }
        }
    }
}
