let PgQuery = require('pg-query-parser');

// =========================================================
// =========================================================
//  == DDL statements
// =========================================================
// =========================================================
  let dumpColumnType = (column) => {
    let names = column.ColumnDef.typeName.TypeName.names.map( obj => obj.String.str);
  
    if (/(int)|(bigserial)/.test(names))
      return "VInteger";
    else if (/text/.test(names))
      return "VString";
    else if (/float/.test(names))
      return "VReal";
    else if (/bool/.test(names))
      return "VBoolean";
    else
      return "VUnit";
  };
  
  let dumpPK = (tableElts) => {
    let compositeKey = tableElts.find(elem => elem.Constraint && elem.Constraint.contype == 4);
    if (compositeKey) {
      let list = compositeKey.Constraint.keys.map( key => `"${key.String.str}"` ).join("; ");
      return `RLSet.from_list [${list}]`;
    } else {
      let key = tableElts.find(elem => elem.ColumnDef && elem.ColumnDef.constraints && elem.ColumnDef.constraints.find( c => c.Constraint && c.Constraint.contype == 4) );
      return `RLSet.singleton "${key.ColumnDef.colname}"`;
    }
  };
 
  let dumpTableElts = (tableElts) => {
    let tail = tableElts
        .filter(elem => elem.ColumnDef)
        .slice(1)
        .reduceRight((accumulator, elem) => {
      if (accumulator) {
        return `(RLMap.add "${elem.ColumnDef.colname}" ${dumpColumnType(elem)} ${accumulator})`;
      } else {
        return `(RLMap.singleton "${elem.ColumnDef.colname}" ${dumpColumnType(elem)})`;
      }
    }, null);
    if (tableElts.length > 1) {
      let elem = tableElts[0];
      return `(RLMap.add "${elem.ColumnDef.colname}" ${dumpColumnType(elem)} ${tail}, [${dumpPK(tableElts)}])`;  
    }
  };
  

// =========================================================
// =========================================================
//  == Stored procedures and DML statements
// =========================================================
// =========================================================

let operMap = { "<@>": "OPGeoDist", "+": "OPPlus", "/": "OPDiv", "=": "OPIsEq", "<": "OPLessThan", "<=": "OPLessEqual", ">": "OPGreaterThan", ">=": "OPGreaterEqual" };

let dumpFieldRenaming = (fields, aliases) => {
    let list = [];
    for (const table_name in fields) {
        // let tmp = fields[table_name].map( field => `("${field}", "${table_name}.${field}")`).join("; ");
        // list.push(`renameTableCols [${tmp}] "${table_name}"`);
        console.log("WORKING WITH", table_name);
        console.log(fields[table_name]);
        let tmp = fields[table_name].map( field => `          RARenameCol("${field}", "${table_name}.${field}",`).join("\n");
        list.push(`${tmp}\n            ${aliases[table_name]}\n          ${fields[table_name].map(a => ")").join("")}`);
    }
    return list;
};

let dumpFieldRenaming2 = (fields, aliases) => {
    let list = [];
    for (const table_name in fields) {
        let tmp = fields[table_name].map( field => `          RARenameCol("${field}", "${table_name}.${field}",`).join("\n");
        list.push(`${tmp}\n            ${aliases[table_name]}\n          ${fields[table_name].map(a => ")").join("")}`);
    }
    return list;
};

let dumpFieldRenaming3 = (fields, parameters) => {
    let list = [];
    for (var index = 0; index < fields.length; index++)
        list.push(`  RARenameCol(${fields[index]}, ${parameters[index]},\n`);
    return list.join("");
};


let traverse = function (node, stack, fdefs, context, fields, aliases, projected_fields) {
    if (Array.isArray(node)) {
        node.forEach((child) => {
            if (child != null)
                traverse(child, stack, fdefs, context, fields, aliases, projected_fields);
        });
    } else if (typeof(node) == "object") {
        if (node.CreateStmt || node.withClause) return;
        if (node.SelectStmt && node.SelectStmt.withClause) {
            traverse(node.SelectStmt.withClause, stack, fdefs, context, fields, aliases, projected_fields);
            console.log("withClause", stack);
        //     var xnode = node.SelectStmt.withClause.WithClause.ctes[0].CommonTableExpr;

        //     var inter = xnode.ctequery.SelectStmt.targetList.filter(elem => !!!(elem.ResTarget.val.FuncCall && elem.ResTarget.val.FuncCall.over)
        // ).reduceRight((acc, elem) => {
        //     if (elem.ResTarget.val.FuncCall) {
        //         let local_stack = [];
        //         traverse(elem.ResTarget, local_stack, fdefs, "projection", fields, aliases, projected_fields);
        //         return `    RANewColumn (\n${acc},\n     "${elem.ResTarget.name}", ${local_stack.pop()})`;
        //     } else if (elem.ResTarget.val.CoalesceExpr || elem.ResTarget.val.MinMaxExpr) {
        //         let local_stack = [];
        //         traverse(elem.ResTarget, local_stack, fdefs, "projection", fields, aliases, projected_fields);
        //         return `    RANewColumn (\n${acc},\n     "${elem.ResTarget.name}", ${local_stack.pop()})`;
        //     } else {
        //         return acc;
        //     }
        // }, stack.pop());

        // var partitions = xnode.ctequery.SelectStmt.targetList.filter(elem => (elem.ResTarget.val.FuncCall && elem.ResTarget.val.FuncCall.over));
        // if (xnode.ctequery.SelectStmt.sortClause && partitions.length > 0) {
        //     let local_stack = [];
        //     let local_fields = {};
        //     traverse(xnode.ctequery.SelectStmt.sortClause, local_stack, fdefs, "function", local_fields, aliases, projected_fields);
        //     let sortingColumns = local_stack.map(elem => '"' + elem.substring(elem.indexOf(".") + 1));

        //     let partition_fields = partitions[0].ResTarget.val.FuncCall.over.WindowDef.partitionClause.map(elem => 
        //         `"${elem.ColumnRef.fields.map(f => f.String.str).join('.')}"`);

        //     sortingColumns = sortingColumns.filter(elem => partition_fields.indexOf(elem) < 0);

        //     stack.push(`    RAAddSortColumn(\n${inter},\n    "${partitions[0].ResTarget.name}", [${partition_fields.join("; ")}], ${sortingColumns.join(", ")})`);
        // } else
        //     stack.push(`${inter},`);

        }

        if (node.fromClause) {
            if (node.whereClause)
                traverse(node.whereClause, [], fdefs, context, fields, aliases, projected_fields);
            else
                traverse(node.fromClause, [],  fdefs, context, fields, aliases, projected_fields);

            if (node.fromClause[0].JoinExpr) {
                console.log("========= from clause with join expr");
                console.log(JSON.stringify(node.fromClause));
                console.log("====================================");
                var joinExpr = node.fromClause[0].JoinExpr;
                if (joinExpr.jointype == 0) {
                    console.log("ABC ABC ABC");
                    let mapping = {};
                    var relname, alias;

                    relname = joinExpr.larg.RangeVar.relname;
                    alias = relname;
                    if (joinExpr.larg.RangeVar.alias)
                        alias = joinExpr.larg.RangeVar.alias.Alias.aliasname;
                    mapping[alias] = `RATable "${relname}"`;

                    var local_stack = [];
                    traverse(joinExpr, local_stack,  fdefs, context, fields, aliases, projected_fields);


                    relname = joinExpr.rarg.RangeFunction.functions[0][0].FuncCall.funcname[0].String.str;
                    alias = relname;
                    if (joinExpr.rarg.RangeFunction.alias)
                        alias = joinExpr.rarg.RangeFunction.alias.Alias.aliasname;
                    mapping[alias] = `RATable "${relname}"`;

                    traverse(node.targetList, [],  fdefs, context, fields, aliases, projected_fields);

                    stack.push(`      RACartesian[\n${dumpFieldRenaming(fields, mapping).join(";\n")}\n      ]`);
                } else {
                    let mapping = {};
                    var relname, alias;

                    relname = joinExpr.larg.RangeVar.relname;
                    alias = relname;
                    if (joinExpr.larg.RangeVar.alias)
                        alias = joinExpr.larg.RangeVar.alias.Alias.aliasname;
                    mapping[alias] = `RATable "${relname}"`;

                    relname = joinExpr.rarg.RangeVar.relname;
                    alias = relname;
                    if (joinExpr.rarg.RangeVar.alias)
                        alias = joinExpr.rarg.RangeVar.alias.Alias.aliasname;
                    mapping[alias] = `RATable "${relname}"`;

                    var local_stack = [];
                    traverse(joinExpr.quals, local_stack,  fdefs, context, fields, aliases, projected_fields);
                    stack.push(`        fullouterjoin\n${dumpFieldRenaming(fields, mapping).map(elem => elem + "\n").join("")}          ${local_stack.pop()}`);
                }
            } else {
                let mapping = node.fromClause.reduce( (acc, clause) => {
                    let local_stack = [];
                    let alias = "", relname = "";

                    if (clause.RangeFunction) {
                        alias = clause.RangeFunction.alias.Alias.aliasname;
                        let name = clause.RangeFunction.functions[0][0].FuncCall.funcname[0].String.str;
                        relname =  `RATable "${name}"`; //= local_stack.pop();
                    } else {
                        alias = clause.RangeVar.relname;
                        if (clause.RangeVar.alias)
                            alias = clause.RangeVar.alias.Alias.aliasname;
                        relname = `RATable "${clause.RangeVar.relname}"`;
                    }
                    acc[alias] = relname;
                    return acc;
                }, {});
                Object.assign(aliases, mapping);

                console.log("I entered the path<<<<<");
                traverse(node.targetList, [], fdefs, "projection", fields, aliases, projected_fields);
                if (node.fromClause && node.fromClause.find(elem => elem.JoinExpr)) {
                    console.log("CASE A");
                    stack.push(`        fullouterjoin\n${dumpFieldRenaming(fields, aliases).map(elem => "          (" + elem + ")\n").join("")}`);
                } else if (node.fromClause && node.whereClause && Object.keys(mapping).length > 1) {
                    console.log("CASE B");
                    stack.push(`        RACartesian [\n${dumpFieldRenaming(fields, aliases).map(elem => elem).join(";\n")}\n        ]`);
                } 
                else {
                    console.log("CASE C");
                    console.log("fields", fields);
                    delete fields.parameters;
                    stack.push(`${dumpFieldRenaming2(fields, aliases).map(elem => elem).join(";\n")}`);                
                }
            }
        }

        if (node.str) {
            stack.push(node.str);
        } else if (node.ival) {
            stack.push(`RAXoper (OPIntConst ${node.ival}, [])`);
        } else if (node.MinMaxExpr) {
            let local_stack = [];
            traverse(node.MinMaxExpr, local_stack, fdefs, "CoalesceExpr", fields, aliases, projected_fields);
            // if (node.MinMaxExpr.op == 0) 
            // console.log("MinMaxExpr", `RAXoper (OPITE, [RAXoper (OPLessThan, [${local_stack[0]}; ${local_stack[1]}]); ${local_stack[0]}; ${local_stack[1]}]))`);
            stack.push(`RAXoper (OPITE, [RAXoper (OPLessThan, [${local_stack[0]}; ${local_stack[1]}]); ${local_stack[0]}; ${local_stack[1]}]))`);
        } else if (node.CoalesceExpr) {
            let local_stack = [];
            traverse(node.CoalesceExpr, local_stack, fdefs, "CoalesceExpr", fields, aliases, projected_fields);
            stack.push(`RAXoper (OPCoalesce, [${local_stack.join("; ")}])`)
        } else if (node.ResTarget) {
            traverse(node.ResTarget, stack, fdefs, context, fields, aliases, projected_fields);
            // console.log("Analyzing", node.ResTarget.name, stack);
            if (node.ResTarget.val.TypeCast) {
                stack.pop(); stack.pop(); // Reference to data type
            }

            if (node.ResTarget.name)
                stack.push({name: node.ResTarget.name, reference: stack.pop()});
        } else if (node.whereClause) {
            traverse(node.whereClause, stack, fdefs, context, fields, aliases, projected_fields);
            let predicate = stack.pop();
            let product = stack.pop();
            stack.push(`      RAFilter (\n${product},\n        ${predicate}\n      )`);
            let inter = stack.pop();

            // Process function calls appearing within the from clause
            console.log("((((((((((((((");
            console.log(JSON.stringify(node.targetList));

            inter = node.targetList.filter(elem => !!!(elem.ResTarget.val.FuncCall && elem.ResTarget.val.FuncCall.over)
            ).reduceRight((acc, elem) => {
                if (elem.ResTarget.val.FuncCall) {
                    let local_stack = [];
                    traverse(elem.ResTarget, local_stack, fdefs, "projection", fields, aliases, projected_fields);
                    return `    RANewColumn (\n${acc},\n     "${elem.ResTarget.name}", ${local_stack.pop()})`;
                } else if (elem.ResTarget.val.CoalesceExpr || elem.ResTarget.val.MinMaxExpr) {
                    let local_stack = [];
                    traverse(elem.ResTarget, local_stack, fdefs, "projection", fields, aliases, projected_fields);
                    return `    RANewColumn (\n${acc},\n     "${elem.ResTarget.name}", ${local_stack.pop()})`;
                } else {
                    return acc;
                }
            }, inter);

            var partitions = node.targetList.filter(elem => (elem.ResTarget.val.FuncCall && elem.ResTarget.val.FuncCall.over));
            if (node.sortClause && partitions.length > 0) {
                let local_stack = [];
                let local_fields = {};
                traverse(node.sortClause, local_stack, fdefs, "function", local_fields, aliases, projected_fields);
                let sortingColumns = local_stack.map(elem => '"' + elem.substring(elem.indexOf(".") + 1));

                let partition_fields = partitions[0].ResTarget.val.FuncCall.over.WindowDef.partitionClause.map(elem => 
                    `"${elem.ColumnRef.fields.map(f => f.String.str).join('.')}"`);

                sortingColumns = sortingColumns.filter(elem => partition_fields.indexOf(elem) < 0);

                stack.push(`    RAAddSortColumn(\n${inter},\n    "${partitions[0].ResTarget.name}", [${partition_fields.join("; ")}], ${sortingColumns.join(", ")})`);
            } else
                stack.push(`${inter},`);
        } else if (node.funcname) {
            let local_stack = [];
            for (var child in node)
                traverse(node[child], local_stack, fdefs, "function", fields, aliases, projected_fields);

            if (local_stack[0] === "point") {
                if (context != "function")
                    stack.push(`RAXattribute ${local_stack[1]}; RAXattribute ${local_stack[2]}`);
                else 
                    stack.push(`${local_stack[1]} ${local_stack[2]}`);
            } else if (local_stack[0] === "ceil") {
                stack.push(`RAXoper (OPCeiling, [${local_stack.pop()}])`);
            } else
                stack.push(`${local_stack[0]} ${local_stack.slice(1).join(" ")}`)
        } else if (node.A_Expr) {
            var local_stack = [];
            for (var child in node)
                traverse(node[child], local_stack, fdefs, "operator", fields, aliases, projected_fields);

            stack.push(`RAXoper (${operMap[local_stack[0]]}, [${local_stack.slice(1).join("; ")}])`);            
        } else if (node.BoolExpr) {
            var local_stack = [];
            traverse(node.BoolExpr, local_stack, fdefs, "operator", fields, aliases, projected_fields);
            stack.push(`RAXoper (OPAnd, [${local_stack.join("; ")}])`);            
        } else if (node.ColumnRef) {
            var local_stack = [];
            for (var child in node)
                traverse(node[child], local_stack, fdefs, context, fields, aliases, projected_fields);

            if (local_stack.length == 1) {
                console.log("CONTEXT", context);
                console.log("field", local_stack);
                local_stack.unshift("parameters");
            }
            let table_name = local_stack[0], field_name = local_stack[1];
            
            if (!fields[table_name])
                fields[table_name] = [];

            if (fields[table_name].indexOf(field_name) < 0)
                fields[table_name].push(field_name);

            if (context === "function")
                stack.push(`"${local_stack.join('.')}"`);
            else if (context === "function-def")
                stack.push(local_stack[local_stack.length - 1]);
            else if (context === "projection")
                stack.push(local_stack[local_stack.length - 1]);
            else        
                stack.push(`RAXattribute "${local_stack.join('.')}"`);               
        } else if (node.CreateFunctionStmt) {
            let functionName = node.CreateFunctionStmt.funcname.map(elem => elem.String.str).join(".");

            let defElem = 
                node.CreateFunctionStmt
                    .options
                    .filter( elem => elem.DefElem.defname == "as" )[0].DefElem;
            let queryString = defElem.arg.map(q => q.String.str).join();
            let ast1 = PgQuery.parse(queryString).query;

            console.log("-------------------------------------");
            console.log(JSON.stringify(ast1));
            console.log("-------------------------------------");            

            if (node.CreateFunctionStmt.returnType.TypeName.setof) {
                var stack1 = [];
                var fields1 = {};
                var aliases1 = {"parameters": 'RATable "parameters"'};
                var projected_fields1 = [];
                traverse(ast1, stack1, fdefs, "function", fields1, aliases1, projected_fields1);
                console.log("++++++>", projected_fields1);

                var parameters =
                node.CreateFunctionStmt.parameters.
                    filter(elem => elem.FunctionParameter.mode == 116).
                    map(elem => `"${elem.FunctionParameter.name}"`);
                console.log("++---->", parameters);

                stack.push(`RALetExp ("${functionName}",\n${dumpFieldRenaming3(projected_fields1, parameters)}${stack1.pop()}\n  ${parameters.map(a => ")").join("")}`);
            } else {
                var stack1 = [];
                var fields1 = {};
                var aliases1 = {};
                var projected_fields1 = [];


                // console.log(JSON.stringify(ast1));

                traverse(ast1, stack1, fdefs, "function-def", fields1, aliases1, projected_fields1);

                var expr = stack1.pop();

                console.log("PROCESSING EXPR", expr);
                expr = expr.replace(/\"parameters.([^\"]+)\"/g, "$1");

                var parameters =
                    node.CreateFunctionStmt.parameters.map( param => param.FunctionParameter.name ).join(" ");

                fdefs.push(`let ${functionName} ${parameters} =\n    ${expr}\nin`);
            }
        } else if (!node.fromClause) {
            for (var child in node)
                traverse(node[child], stack, fdefs, context, fields, aliases, projected_fields);
        }

        if (node.SelectStmt) {
            var proj_aliases = [];
            var partitions = [];
            var projection =
            node.SelectStmt.targetList.filter(elem => elem.ResTarget.val.ColumnRef || elem.ResTarget.val.FuncCall || elem.ResTarget.val.CoalesceExpr || elem.ResTarget.val.MinMaxExpr).map(elem => {
                let value = elem.ResTarget.val;
                if (value.ColumnRef) {
                    proj_aliases.push(`"${elem.ResTarget.name}"`);

                    let local_fields = {};
                    traverse(value, [], [], "projection", local_fields, {}, projected_fields);
                    let list = [];
                    for (const table_name in local_fields)
                        local_fields[table_name].forEach(value => list.push(`"${table_name}.${value}"`));
                    return list.join("");
                } else if (value.FuncCall) {
                    if (value.FuncCall.over) {
                        console.log("PARTITION OVER:");
                        var part_fields = value.FuncCall.over.WindowDef.partitionClause.map(elem => {
                            let local_fields = {};
                            traverse(elem, [], [], "projection", local_fields, {}, []);
                            // console.log("Elem", JSON.stringify(elem));
                            // console.log("fields", JSON.stringify(local_fields));
                            var result = "";
                            for (const table_name in local_fields)
                                result += `"${local_fields[table_name]}"`;
                            return result;
                        });

                        var partition_expression = `"${elem.ResTarget.name}", [${part_fields.join("; ")}], OOOPS: "${elem.ResTarget.name}"`;
                        console.log("HERE", partition_expression);
                        partitions.push(partition_expression);
                    }
                    proj_aliases.push(`"${elem.ResTarget.name}"`);

                    return `"${elem.ResTarget.name}"`;
                } else if (value.CoalesceExpr) {
                    proj_aliases.push(`"${elem.ResTarget.name}"`);
                    return `"${elem.ResTarget.name}"`;                    
                } else if (value.MinMaxExpr) {
                    console.log("YYYYYYYYYEEEEEEEESSSSSSS");
                    proj_aliases.push(`"${elem.ResTarget.name}"`);
                    return `"${elem.ResTarget.name}"`;
                }
            });


            projected_fields.push(...projection);
            console.log("IN the stack", stack);
            console.log("partitions", partitions);



            // if (context !== 'function-def') {
            //     stack.push(`  RAProject(\n${stack.pop()}\n    [${projection.join("; ")}]\n  )`);
            // } else {
                var projection_part = `    RAProject(\n${stack.pop()},\n      [${projection.join("; ")}])`;
                projection_part = partitions.reduceRight((acc, elem) => `    RAAddSortColumn (\n${acc},\n    ${elem})`, projection_part);
                stack.push(`${dumpFieldRenaming3(projection, proj_aliases)}${projection_part}\n  ${projection.map(e => ")").join("")}`);
                
                if (node.SelectStmt.intoClause) {
                    var relName = node.SelectStmt.intoClause.IntoClause.rel.RangeVar.relname;
                    stack.push(`RALetExp ("${relName}",${stack.pop()}`);
                }
            // }

            // if (node.SelectStmt.intoClause) {
            //     var relName = node.SelectStmt.intoClause.IntoClause.rel.RangeVar.relname;
            //     var projection_part = `    RAProject(\n${stack.pop()},\n      [${projection.join("; ")}])`;

            //     projection_part = partitions.reduceRight((acc, elem) => `    RAAddSortColumn (\n${acc},\n    ${elem})`, projection_part);

            //     stack.push(`RALetExp ("${relName}",\n${dumpFieldRenaming3(projection, proj_aliases)}${projection_part}\n  ${projection.map(e => ")").join("")}`);
            // } else if (partitions.length > 0) {
            //     // var relName = node.SelectStmt.intoClause.IntoClause.rel.RangeVar.relname;
            //     var projection_part = `    RAProject(\n${stack.pop()},\n      [${projection.join("; ")}])`;

            //     projection_part = partitions.reduceRight((acc, elem) => `    RAAddSortColumn (\n${acc},\n    ${elem})`, projection_part);

            //     stack.push(`${dumpFieldRenaming3(projection, proj_aliases)}${projection_part}\n  ${projection.map(e => ")").join("")}`);
            // } else if (context !== 'function-def') {
            //     stack.push(`  RAProject(\n${stack.pop()}\n    [${projection.join("; ")}]\n  )`);
            // }
        }
    }
};

let analyzeDDL = (ast) => {
    let ddl = ast.filter( stmt => stmt.CreateStmt );
    if (ddl.length > 0) {
        let result =
            ddl.reduceRight((accumulator, stmt) => {
            let relname = stmt.CreateStmt.relation.RangeVar.relname;
            let tableElts = stmt.CreateStmt.tableElts;
            if (accumulator) {
                return `  RLMap.add "${relname}"\n    ${dumpTableElts(tableElts)}\n  (\n${accumulator})`;
            } else {
                return `  RLMap.singleton "${relname}"\n    ${dumpTableElts(tableElts)}\n  `;
            }
            }, null) + ";;";
        return `let aiddistrDbdesc =\n   ${result}`;
    }
    return "";
}

let analyzeDML = (ast, targets) => {
    let dml = ast.filter( stmt => !!!stmt.CreateStmt );
    if (dml.length > 0) {
        var stack = [];
        var fdefs = [];
        traverse(dml, stack, fdefs, "function", {}, {"parameters": 'RATable "parameters"'}, []);

        console.log("TARGETS::", targets);

        var str = ',\n  RATable "ABCD"\n';
        if (targets) {
            if (targets.length > 1) {
                var mstr = targets.reduce((acc, t) => { if (acc) return `RAUnionWithDifferentSchema(${acc}, RATable "${t}")`; else return `RATable "${t}"`}, null);
                str = `,\n  ${mstr}\n`;
            } else
                str = `,\n  RATable "${targets[0]}"\n`;
        }
        for (i = 0; i < stack.length; i++)
            str += ")";

        return `let aiddistrQuery =\n${fdefs.join("\n") + "\n" + stack.join(",\n") + str + ";;"}`;
    }
    return "";
}

module.exports = {
    analyze: function(query, targets) {
        let result = PgQuery.parse(query);
        let ast = result.query;
        console.log('=============================================');
        console.log(JSON.stringify(ast));
        console.log('=============================================');
        var ddlstr = analyzeDDL(ast);
        var dmlstr = analyzeDML(ast, targets);

        let res = `open GrbGraphs;;\nopen GrbInput;;\n\n${ddlstr}\n\n${dmlstr}\n`;
        console.log(res);
        return res;
    }
}