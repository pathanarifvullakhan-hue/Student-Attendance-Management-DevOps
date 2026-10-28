
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
                        --volumes-from jenkins \
                        -w "$WORKSPACE" \
                        node:22 \
                        sh -c "npm install && npm test"
                '''
            }
        }

        stage('Build Docker Image') {
            steps {
                sh 'docker build -t student-attendance:latest .'
            }
        }
    }
}
