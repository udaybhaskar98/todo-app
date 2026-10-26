url format:
postgresql://uday:PASSWORD@db-service:5432/todoapp-db
             username:dbpassword@db-service-name/db-name.

kubectl create secret generic backend-db-url \
  -n todo-app \
  --from-literal=DATABASE_URL="postgresql://uday:$(kubectl get secret db-secret -n todo-app -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 --decode)@db-service:5432/todoapp-db" 

  this command: get the password from secret decode it and give the url