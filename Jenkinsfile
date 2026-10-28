
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
                    --user 0:0 \
                    --volumes-from jenkins \
                    -w "$WORKSPACE" \
                    -e KUBECONFIG="$KUBECONFIG" \
                    bitnami/kubectl:latest \
                    apply -f k8s/deployment.yaml

                docker run --rm \
                    --user 0:0 \
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
