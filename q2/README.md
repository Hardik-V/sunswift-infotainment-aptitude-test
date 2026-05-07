To run

`npm install`

`node server.js`

To POST use:
```
curl -X POST http://localhost:3001/logs/upload \
-H "Content-Type: application/json" \
-d '[{"timestamp": 1714416000000, "component": "battery", "value": 72.5}]' && echo
```
To GET Use:

```
curl http://localhost:3001/logs/summary && echo
```

Or Postman as per preference.