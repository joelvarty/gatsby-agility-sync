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
NODE_ENV=production gatbsy build

```

### Deploy to Netlify (for testing)
```shell
netlify deploy --dir=public --open
```




