pipeline {
  agent any
  tools {
    nodejs 'Node20'
  }
  environment {
    CI = 'true'
  }
  stages {
    stage('Checkout') {
      steps { checkout scm }
    }
    stage('Install dependencies') {
      steps { sh 'npm install' }
    }
    stage('Syntax validation') {
      steps {
        sh 'node --check server.js'
        sh 'node --check frontend/app.js'
        sh 'node --check tests/api.test.js'
      }
    }
    stage('Automated API tests') {
      steps { sh 'npm test' }
    }
    stage('Build Docker image') {
      steps {
        sh 'docker build -t student-attendance-devops:${BUILD_NUMBER} .'
      }
    }
  }
  post {
    always { echo 'Attendance application pipeline finished.' }
  }
}
