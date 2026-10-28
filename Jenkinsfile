
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
                        node:20 \
                        sh -c "npm install && npm test"
                '''
            }
        }

        stage('Build Docker Image') {
            steps {
                sh 'docker build -t student-attendance-devops:1.0 .'
            }
        }

        stage('Deploy to Kubernetes') {
            steps {
                withCredentials([
                    file(
                        credentialsId: 'kubernetes-config',
                        variable: 'KUBECONFIG'
                    )
                ]) {
                    sh '''
                        docker run --rm \
                            --volumes-from jenkins \
                            -w "$WORKSPACE" \
                            -e KUBECONFIG="$KUBECONFIG" \
                            bitnami/kubectl:latest \
                            apply -f k8s/deployment.yaml

                        docker run --rm \
                            --volumes-from jenkins \
                            -w "$WORKSPACE" \
                            -e KUBECONFIG="$KUBECONFIG" \
                            bitnami/kubectl:latest \
                            rollout status deployment/student-attendance \
                            --timeout=120s
                    '''
                }
            }
        }
    }
}
