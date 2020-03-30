# Wrapper component for the SQL leaks-when analysis tool for pleak.io

## Requirements

You need to locate pleak-leaks-when-ast-transformation, [pleak-backend](https://github.com/pleak-tools/pleak-backend), [pleak-frontend](https://github.com/pleak-tools/pleak-frontend) and [pleak-pe-bpmn-editor](https://github.com/pleak-tools/pleak-pe-bpmn-editor) directories all in the same directory. Specify names for the first three modules in the config.json file.
Read more from sub-repositories how to build each module.

For the SQL leaks-when analysis tool in [pleak-leaks-when-analysis](https://github.com/pleak-tools/pleak-leaks-when-analysis) submodule:

- Z3 Theorem Prover - to install, you can clone it from [https://github.com/Z3Prover/z3](https://github.com/Z3Prover/z3) and compile it yourself or (on some Linux versions, for example Ubuntu) execute `apt install z3`. You will need Z3 to be in the PATH.
- opam (`apt install opam`)
- ocaml (`apt install ocaml`) - version 4.02.0 is needed (`opam switch 4.02.0`)
- ocamlgraph (`opam install ocamlgraph` / `apt install libocamlgraph-ocaml-dev`)
- xml-light (`opam install xml-light` / `apt install libxml-light-ocaml-dev`)
- Yojson (`opam install Yojson`)

Based on environment, you might also need to install:

- m4 (`apt install m4`)
- ocamlfind (`opam install ocamlfind`)

## Installing & building

To build the wrapper component you need: [NodeJS](http://nodejs.org) with [npm](https://npmjs.org) installed.

To install the SQL leaks-when analyzer, git clone this repository with `--recurse-submodules` flag and execute

```
npm install
```

Serve the wrapper component locally with

```
node server.js
```

## Using

You can use the analyser through [Pleak PE-BPMN & Leaks-When editor](https://github.com/pleak-tools/pleak-pe-bpmn-editor).

## License

MIT
