# Wrapper component for the SQL leaks-when analysis tool for pleak.io

## Requirements

For [pleak-leaks-when-analysis](https://github.com/pleak-tools/pleak-leaks-when-analysis) submodule:

- ocaml (`apt install ocaml`)
- opam (`apt install opam`)
- libocamlgraph-ocaml-dev (`apt install libocamlgraph-ocaml-dev` / `opam install ocamlgraph`)
- libxml-light-ocaml-dev (`apt install libxml-light-ocaml-dev` / `opam install xml-light`)
- Z3 Theorem Prover - to install, you can clone it from [https://github.com/Z3Prover/z3](https://github.com/Z3Prover/z3) and compile it yourself or (on some Linux versions, for example Ubuntu 16.4) execute `apt install z3`. You will need Z3 to be in the PATH.

Based on environment, you might also need to install:

- m4 (`apt install m4`)
- ocamlfind (`opam install ocamlfind`)

## Installing & building

To build the wrapper component you need: [NodeJS](http://nodejs.org) with [npm](https://npmjs.org) installed.

To install all project dependencies git clone with `--recurse-submodules` flag and execute

```
npm install
```

Serve the wrapper component locally with

```
node server.js