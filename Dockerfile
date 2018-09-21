FROM ubuntu:16.04

RUN apt-get update

RUN apt install -y ocaml
RUN apt install -y opam
RUN apt-get install -y libocamlgraph-ocaml-dev
RUN apt-get -y install libxml-light-ocaml-dev

RUN apt install -y curl
RUN curl -sL https://deb.nodesource.com/setup_8.x

RUN apt-get install -y nodejs
RUN apt-get install -y npm

RUN npm cache clean -f
RUN npm install -g n
RUN n stable

RUN ln -s /usr/bin/nodejs /usr/bin/node

RUN apt -y install default-jre

WORKDIR /usr/pleak
RUN git clone https://github.com/Z3Prover/z3.git
WORKDIR /usr/pleak/z3
RUN python scripts/mk_make.py
WORKDIR /usr/pleak/z3/build
RUN make
RUN make install

ENV PATH "$PATH:/home/pleak/.local/bin/z3/bin"

WORKDIR /usr/pleak

COPY . /usr/pleak
WORKDIR /usr/pleak
RUN mkdir /data
RUN npm install sudo
RUN chmod 777 /usr/pleak/scripts/*.sh

RUN ./scripts/build.sh
CMD nohup node ./server.js