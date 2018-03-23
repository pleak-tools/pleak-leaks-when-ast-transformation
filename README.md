

```
docker build -t pleaktools/leakswhen .
docker run --rm -it -p 3000:3000 pleaktools/leakswhen
```

```
curl -d @examples/script-part1.sql http://localhost:3000/upload?model=abc&targets=reachable_ports
```