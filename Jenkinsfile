pipeline {
    agent {label "ec2-agent"}
    
    
    stages {
        stage ("Code") {
            steps {
                echo "This is cloning the clode"
                git url: "https://github.com/udaybhaskar98/todo-app.git", branch: "main"
            }
            
        }
        
        stage('Check Configuration') {
            steps {
                sh '''
                    echo "AWS Region: ${AWS_REGION}"
                    echo "ECR Registry: ${ECR_REGISTRY}"
                    '''
            }
        }
       
        stage ("Build") {
            steps {
                echo "Building frontend and backend images"
                sh '''
                    docker build \
                        -f frontend/Dockerfile \
                        -t ${ECR_REGISTRY}/todo-frontend:v1 .
                    docker build \
                        -f backend/Dockerfile \
                        -t ${ECR_REGISTRY}/todo-backend:v1 .
                    '''
            }
        }
        stage ("Login to ECR") {
            steps {
                echo "Login to AWS ECR"
                sh '''
                    aws ecr get-login-password --region ${AWS_REGION} |
                    docker login \
                        --username AWS \
                        --password-stdin ${ECR_REGISTRY}
                    '''
            }
        }
        
        stage ("Push to ECR") {
            steps {
                sh '''
                    docker push ${ECR_REGISTRY}/todo-frontend:v1
                    docker push ${ECR_REGISTRY}/todo-backend:v1
                   '''
            }
        }
        stage ("Deploy") {
            steps {
                echo "Deploying the application"
                sh '''
                    docker compose -f compose.deploy.yml config
                    docker compose -f compose.deploy.yml pull
                    docker compose -f compose.deploy.yml up -d
                    docker compose -f compose.deploy.yml ps
                   '''
                
            }
        }
    }
}