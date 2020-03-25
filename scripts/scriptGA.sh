#!/bin/sh
SERVERDIR=$1
OUTPUT=$2
cd "$1/pleak-leaks-when-analysis/src"
echo "We are at $1, trying to run GrbtoGA.native here"
wait
#ocamlbuild -use-ocamlfind GrbToGA.native
#rc=$?; if [[ $rc != 0 ]]; then exit $rc; fi
./GrbToGA.native "$1$OUTPUT"
retVal=$?
if [ $retVal -ne 0 ]; then
    echo "Could not run GrbtoGA.native, something is wrong with ast-transformer output"
else
    echo "We have succesfully finished running $1/GrbtoGA.native"
fi

