# Gatsby Sync Example

- This project is hooked up to a git repo which triggers a build to Gatsby Cloud
- Git Repo: https://github.com/joelvarty/gatsby-agility-sync
- Dashboard: https://www.gatsbyjs.com/dashboard/

### Local build for dev
```shell
gatsby develop
```

### to refresh local build:
```shell
curl -X POST http://localhost:8000/__refresh
```

### To clean out any cache
```shell
gatsby clean
```

### To build for production
```shell
NODE_ENV=production
gatbsy build

```

### Deploy to Netlify (for testing)
```shell
netlify deploy --dir=public --open
```

### Run in Docker
```shell
docker build -f Dockerfile.dev -t agility-gatsby-dev .

docker run -p 80:80 --name agility-gatsby-dev agility-gatsby-dev
#{OR}
docker-compose up --build
```
### Publish to Docker Container Registry
```shell
docker build -f Dockerfile.dev -t {containerRegistryUrl}/agility-gatsby-dev .
docker login -u {username} -p {password} {containerRegistryUrl}
docker push {containerRegistryUrl}/agility-gatsby-dev
```