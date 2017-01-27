/*
Yellow code - a jQuery plugin for 2-way data binding, version 0.99.10 (http://any3w.com/ylc). Distributed under the the BSD 2-Clause License (http://any3w.com/ylc/LICENSE.txt). Internally uses JavaScript Expression Parser (JSEP)  0.3.0 distributed under the MIT License (http://jsep.from.so/).
*/


(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
//     JavaScript Expression Parser (JSEP) 0.3.0
//     JSEP may be freely distributed under the MIT License
//     http://jsep.from.so/

/*global module: true, exports: true, console: true */
(function (root) {
	'use strict';
	// Node Types
	// ----------
	
	// This is the full set of types that any JSEP node can be.
	// Store them here to save space when minified
	var COMPOUND = 'Compound',
		IDENTIFIER = 'Identifier',
		MEMBER_EXP = 'MemberExpression',
		LITERAL = 'Literal',
		THIS_EXP = 'ThisExpression',
		CALL_EXP = 'CallExpression',
		UNARY_EXP = 'UnaryExpression',
		BINARY_EXP = 'BinaryExpression',
		LOGICAL_EXP = 'LogicalExpression',
		CONDITIONAL_EXP = 'ConditionalExpression',
		ARRAY_EXP = 'ArrayExpression',

		PERIOD_CODE = 46, // '.'
		COMMA_CODE  = 44, // ','
		SQUOTE_CODE = 39, // single quote
		DQUOTE_CODE = 34, // double quotes
		OPAREN_CODE = 40, // (
		CPAREN_CODE = 41, // )
		OBRACK_CODE = 91, // [
		CBRACK_CODE = 93, // ]
		QUMARK_CODE = 63, // ?
		SEMCOL_CODE = 59, // ;
		COLON_CODE  = 58, // :

		throwError = function(message, index) {
			var error = new Error(message + ' at character ' + index);
			error.index = index;
			error.description = message;
			throw error;
		},

	// Operations
	// ----------
	
	// Set `t` to `true` to save space (when minified, not gzipped)
		t = true,
	// Use a quickly-accessible map to store all of the unary operators
	// Values are set to `true` (it really doesn't matter)
		unary_ops = {'-': t, '!': t, '~': t, '+': t},
	// Also use a map for the binary operations but set their values to their
	// binary precedence for quick reference:
	// see [Order of operations](http://en.wikipedia.org/wiki/Order_of_operations#Programming_language)
		binary_ops = {
			'||': 1, '&&': 2, '|': 3,  '^': 4,  '&': 5,
			'==': 6, '!=': 6, '===': 6, '!==': 6,
			'<': 7,  '>': 7,  '<=': 7,  '>=': 7, 
			'<<':8,  '>>': 8, '>>>': 8,
			'+': 9, '-': 9,
			'*': 10, '/': 10, '%': 10
		},
	// Get return the longest key length of any object
		getMaxKeyLen = function(obj) {
			var max_len = 0, len;
			for(var key in obj) {
				if((len = key.length) > max_len && obj.hasOwnProperty(key)) {
					max_len = len;
				}
			}
			return max_len;
		},
		max_unop_len = getMaxKeyLen(unary_ops),
		max_binop_len = getMaxKeyLen(binary_ops),
	// Literals
	// ----------
	// Store the values to return for the various literals we may encounter
		literals = {
			'true': true,
			'false': false,
			'null': null
		},
	// Except for `this`, which is special. This could be changed to something like `'self'` as well
		this_str = 'this',
	// Returns the precedence of a binary operator or `0` if it isn't a binary operator
		binaryPrecedence = function(op_val) {
			return binary_ops[op_val] || 0;
		},
	// Utility function (gets called from multiple places)
	// Also note that `a && b` and `a || b` are *logical* expressions, not binary expressions
		createBinaryExpression = function (operator, left, right) {
			var type = (operator === '||' || operator === '&&') ? LOGICAL_EXP : BINARY_EXP;
			return {
				type: type,
				operator: operator,
				left: left,
				right: right
			};
		},
		// `ch` is a character code in the next three functions
		isDecimalDigit = function(ch) {
			return (ch >= 48 && ch <= 57); // 0...9
		},
		isIdentifierStart = function(ch) {
			return (ch === 36) || (ch === 95) || // `$` and `_`
					(ch >= 65 && ch <= 90) || // A...Z
					(ch >= 97 && ch <= 122); // a...z
		},
		isIdentifierPart = function(ch) {
			return (ch === 36) || (ch === 95) || // `$` and `_`
					(ch >= 65 && ch <= 90) || // A...Z
					(ch >= 97 && ch <= 122) || // a...z
					(ch >= 48 && ch <= 57); // 0...9
		},

		// Parsing
		// -------
		// `expr` is a string with the passed in expression
		jsep = function(expr) {
			// `index` stores the character number we are currently at while `length` is a constant
			// All of the gobbles below will modify `index` as we move along
			var index = 0,
				charAtFunc = expr.charAt,
				charCodeAtFunc = expr.charCodeAt,
				exprI = function(i) { return charAtFunc.call(expr, i); },
				exprICode = function(i) { return charCodeAtFunc.call(expr, i); },
				length = expr.length,

				// Push `index` up to the next non-space character
				gobbleSpaces = function() {
					var ch = exprICode(index);
					// space or tab
					while(ch === 32 || ch === 9) {
						ch = exprICode(++index);
					}
				},
				
				// The main parsing function. Much of this code is dedicated to ternary expressions
				gobbleExpression = function() {
					var test = gobbleBinaryExpression(),
						consequent, alternate;
					gobbleSpaces();
					if(exprICode(index) === QUMARK_CODE) {
						// Ternary expression: test ? consequent : alternate
						index++;
						consequent = gobbleExpression();
						if(!consequent) {
							throwError('Expected expression', index);
						}
						gobbleSpaces();
						if(exprICode(index) === COLON_CODE) {
							index++;
							alternate = gobbleExpression();
							if(!alternate) {
								throwError('Expected expression', index);
							}
							return {
								type: CONDITIONAL_EXP,
								test: test,
								consequent: consequent,
								alternate: alternate
							};
						} else {
							throwError('Expected :', index);
						}
					} else {
						return test;
					}
				},

				// Search for the operation portion of the string (e.g. `+`, `===`)
				// Start by taking the longest possible binary operations (3 characters: `===`, `!==`, `>>>`)
				// and move down from 3 to 2 to 1 character until a matching binary operation is found
				// then, return that binary operation
				gobbleBinaryOp = function() {
					gobbleSpaces();
					var biop, to_check = expr.substr(index, max_binop_len), tc_len = to_check.length;
					while(tc_len > 0) {
						if(binary_ops.hasOwnProperty(to_check)) {
							index += tc_len;
							return to_check;
						}
						to_check = to_check.substr(0, --tc_len);
					}
					return false;
				},

				// This function is responsible for gobbling an individual expression,
				// e.g. `1`, `1+2`, `a+(b*2)-Math.sqrt(2)`
				gobbleBinaryExpression = function() {
					var ch_i, node, biop, prec, stack, biop_info, left, right, i;

					// First, try to get the leftmost thing
					// Then, check to see if there's a binary operator operating on that leftmost thing
					left = gobbleToken();
					biop = gobbleBinaryOp();

					// If there wasn't a binary operator, just return the leftmost node
					if(!biop) {
						return left;
					}

					// Otherwise, we need to start a stack to properly place the binary operations in their
					// precedence structure
					biop_info = { value: biop, prec: binaryPrecedence(biop)};

					right = gobbleToken();
					if(!right) {
						throwError("Expected expression after " + biop, index);
					}
					stack = [left, biop_info, right];

					// Properly deal with precedence using [recursive descent](http://www.engr.mun.ca/~theo/Misc/exp_parsing.htm)
					while((biop = gobbleBinaryOp())) {
						prec = binaryPrecedence(biop);

						if(prec === 0) {
							break;
						}
						biop_info = { value: biop, prec: prec };

						// Reduce: make a binary expression from the three topmost entries.
						while ((stack.length > 2) && (prec <= stack[stack.length - 2].prec)) {
							right = stack.pop();
							biop = stack.pop().value;
							left = stack.pop();
							node = createBinaryExpression(biop, left, right);
							stack.push(node);
						}

						node = gobbleToken();
						if(!node) {
							throwError("Expected expression after " + biop, index);
						}
						stack.push(biop_info, node);
					}

					i = stack.length - 1;
					node = stack[i];
					while(i > 1) {
						node = createBinaryExpression(stack[i - 1].value, stack[i - 2], node); 
						i -= 2;
					}
					return node;
				},

				// An individual part of a binary expression:
				// e.g. `foo.bar(baz)`, `1`, `"abc"`, `(a % 2)` (because it's in parenthesis)
				gobbleToken = function() {
					var ch, to_check, tc_len;
					
					gobbleSpaces();
					ch = exprICode(index);

					if(isDecimalDigit(ch) || ch === PERIOD_CODE) {
						// Char code 46 is a dot `.` which can start off a numeric literal
						return gobbleNumericLiteral();
					} else if(ch === SQUOTE_CODE || ch === DQUOTE_CODE) {
						// Single or double quotes
						return gobbleStringLiteral();
					} else if(isIdentifierStart(ch) || ch === OPAREN_CODE) { // open parenthesis
						// `foo`, `bar.baz`
						return gobbleVariable();
					} else if (ch === OBRACK_CODE) {
						return gobbleArray();
					} else {
						to_check = expr.substr(index, max_unop_len);
						tc_len = to_check.length;
						while(tc_len > 0) {
							if(unary_ops.hasOwnProperty(to_check)) {
								index += tc_len;
								return {
									type: UNARY_EXP,
									operator: to_check,
									argument: gobbleToken(),
									prefix: true
								};
							}
							to_check = to_check.substr(0, --tc_len);
						}
						
						return false;
					}
				},
				// Parse simple numeric literals: `12`, `3.4`, `.5`. Do this by using a string to
				// keep track of everything in the numeric literal and then calling `parseFloat` on that string
				gobbleNumericLiteral = function() {
					var number = '', ch, chCode;
					while(isDecimalDigit(exprICode(index))) {
						number += exprI(index++);
					}

					if(exprICode(index) === PERIOD_CODE) { // can start with a decimal marker
						number += exprI(index++);

						while(isDecimalDigit(exprICode(index))) {
							number += exprI(index++);
						}
					}
					
					ch = exprI(index);
					if(ch === 'e' || ch === 'E') { // exponent marker
						number += exprI(index++);
						ch = exprI(index);
						if(ch === '+' || ch === '-') { // exponent sign
							number += exprI(index++);
						}
						while(isDecimalDigit(exprICode(index))) { //exponent itself
							number += exprI(index++);
						}
						if(!isDecimalDigit(exprICode(index-1)) ) {
							throwError('Expected exponent (' + number + exprI(index) + ')', index);
						}
					}
					

					chCode = exprICode(index);
					// Check to make sure this isn't a variable name that start with a number (123abc)
					if(isIdentifierStart(chCode)) {
						throwError('Variable names cannot start with a number (' +
									number + exprI(index) + ')', index);
					} else if(chCode === PERIOD_CODE) {
						throwError('Unexpected period', index);
					}

					return {
						type: LITERAL,
						value: parseFloat(number),
						raw: number
					};
				},

				// Parses a string literal, staring with single or double quotes with basic support for escape codes
				// e.g. `"hello world"`, `'this is\nJSEP'`
				gobbleStringLiteral = function() {
					var str = '', quote = exprI(index++), closed = false, ch;

					while(index < length) {
						ch = exprI(index++);
						if(ch === quote) {
							closed = true;
							break;
						} else if(ch === '\\') {
							// Check for all of the common escape codes
							ch = exprI(index++);
							switch(ch) {
								case 'n': str += '\n'; break;
								case 'r': str += '\r'; break;
								case 't': str += '\t'; break;
								case 'b': str += '\b'; break;
								case 'f': str += '\f'; break;
								case 'v': str += '\x0B'; break;
							}
						} else {
							str += ch;
						}
					}

					if(!closed) {
						throwError('Unclosed quote after "'+str+'"', index);
					}

					return {
						type: LITERAL,
						value: str,
						raw: quote + str + quote
					};
				},
				
				// Gobbles only identifiers
				// e.g.: `foo`, `_value`, `$x1`
				// Also, this function checks if that identifier is a literal:
				// (e.g. `true`, `false`, `null`) or `this`
				gobbleIdentifier = function() {
					var ch = exprICode(index), start = index, identifier;

					if(isIdentifierStart(ch)) {
						index++;
					} else {
						throwError('Unexpected ' + exprI(index), index);
					}

					while(index < length) {
						ch = exprICode(index);
						if(isIdentifierPart(ch)) {
							index++;
						} else {
							break;
						}
					}
					identifier = expr.slice(start, index);

					if(literals.hasOwnProperty(identifier)) {
						return {
							type: LITERAL,
							value: literals[identifier],
							raw: identifier
						};
					} else if(identifier === this_str) {
						return { type: THIS_EXP };
					} else {
						return {
							type: IDENTIFIER,
							name: identifier
						};
					}
				},

				// Gobbles a list of arguments within the context of a function call
				// or array literal. This function also assumes that the opening character
				// `(` or `[` has already been gobbled, and gobbles expressions and commas
				// until the terminator character `)` or `]` is encountered.
				// e.g. `foo(bar, baz)`, `my_func()`, or `[bar, baz]`
				gobbleArguments = function(termination) {
					var ch_i, args = [], node;
					while(index < length) {
						gobbleSpaces();
						ch_i = exprICode(index);
						if(ch_i === termination) { // done parsing
							index++;
							break;
						} else if (ch_i === COMMA_CODE) { // between expressions
							index++;
						} else {
							node = gobbleExpression();
							if(!node || node.type === COMPOUND) {
								throwError('Expected comma', index);
							}
							args.push(node);
						}
					}
					return args;
				},

				// Gobble a non-literal variable name. This variable name may include properties
				// e.g. `foo`, `bar.baz`, `foo['bar'].baz`
				// It also gobbles function calls:
				// e.g. `Math.acos(obj.angle)`
				gobbleVariable = function() {
					var ch_i, node;
					ch_i = exprICode(index);
						
					if(ch_i === OPAREN_CODE) {
						node = gobbleGroup();
					} else {
						node = gobbleIdentifier();
					}
					gobbleSpaces();
					ch_i = exprICode(index);
					while(ch_i === PERIOD_CODE || ch_i === OBRACK_CODE || ch_i === OPAREN_CODE) {
						index++;
						if(ch_i === PERIOD_CODE) {
							gobbleSpaces();
							node = {
								type: MEMBER_EXP,
								computed: false,
								object: node,
								property: gobbleIdentifier()
							};
						} else if(ch_i === OBRACK_CODE) {
							node = {
								type: MEMBER_EXP,
								computed: true,
								object: node,
								property: gobbleExpression()
							};
							gobbleSpaces();
							ch_i = exprICode(index);
							if(ch_i !== CBRACK_CODE) {
								throwError('Unclosed [', index);
							}
							index++;
						} else if(ch_i === OPAREN_CODE) {
							// A function call is being made; gobble all the arguments
							node = {
								type: CALL_EXP,
								'arguments': gobbleArguments(CPAREN_CODE),
								callee: node
							};
						}
						gobbleSpaces();
						ch_i = exprICode(index);
					}
					return node;
				},

				// Responsible for parsing a group of things within parentheses `()`
				// This function assumes that it needs to gobble the opening parenthesis
				// and then tries to gobble everything within that parenthesis, assuming
				// that the next thing it should see is the close parenthesis. If not,
				// then the expression probably doesn't have a `)`
				gobbleGroup = function() {
					index++;
					var node = gobbleExpression();
					gobbleSpaces();
					if(exprICode(index) === CPAREN_CODE) {
						index++;
						return node;
					} else {
						throwError('Unclosed (', index);
					}
				},

				// Responsible for parsing Array literals `[1, 2, 3]`
				// This function assumes that it needs to gobble the opening bracket
				// and then tries to gobble the expressions as arguments.
				gobbleArray = function() {
					index++;
					return {
						type: ARRAY_EXP,
						elements: gobbleArguments(CBRACK_CODE)
					};
				},

				nodes = [], ch_i, node;
				
			while(index < length) {
				ch_i = exprICode(index);

				// Expressions can be separated by semicolons, commas, or just inferred without any
				// separators
				if(ch_i === SEMCOL_CODE || ch_i === COMMA_CODE) {
					index++; // ignore separators
				} else {
					// Try to gobble each expression individually
					if((node = gobbleExpression())) {
						nodes.push(node);
					// If we weren't able to find a binary expression and are out of room, then
					// the expression passed in probably has too much
					} else if(index < length) {
						throwError('Unexpected "' + exprI(index) + '"', index);
					}
				}
			}

			// If there's only one expression just try returning the expression
			if(nodes.length === 1) {
				return nodes[0];
			} else {
				return {
					type: COMPOUND,
					body: nodes
				};
			}
		};

	// To be filled in by the template
	jsep.version = '0.3.0';
	jsep.toString = function() { return 'JavaScript Expression Parser (JSEP) v' + jsep.version; };

	/**
	 * @method jsep.addUnaryOp
	 * @param {string} op_name The name of the unary op to add
	 * @return jsep
	 */
	jsep.addUnaryOp = function(op_name) {
		unary_ops[op_name] = t; return this;
	};

	/**
	 * @method jsep.addBinaryOp
	 * @param {string} op_name The name of the binary op to add
	 * @param {number} precedence The precedence of the binary op (can be a float)
	 * @return jsep
	 */
	jsep.addBinaryOp = function(op_name, precedence) {
		max_binop_len = Math.max(op_name.length, max_binop_len);
		binary_ops[op_name] = precedence;
		return this;
	};

	/**
	 * @method jsep.removeUnaryOp
	 * @param {string} op_name The name of the unary op to remove
	 * @return jsep
	 */
	jsep.removeUnaryOp = function(op_name) {
		delete unary_ops[op_name];
		if(op_name.length === max_unop_len) {
			max_unop_len = getMaxKeyLen(unary_ops);
		}
		return this;
	};

	/**
	 * @method jsep.removeBinaryOp
	 * @param {string} op_name The name of the binary op to remove
	 * @return jsep
	 */
	jsep.removeBinaryOp = function(op_name) {
		delete binary_ops[op_name];
		if(op_name.length === max_binop_len) {
			max_binop_len = getMaxKeyLen(binary_ops);
		}
		return this;
	};

	// In desktop environments, have a way to restore the old value for `jsep`
	if (typeof exports === 'undefined') {
		var old_jsep = root.jsep;
		// The star of the show! It's a function!
		root.jsep = jsep;
		// And a courteous function willing to move out of the way for other similarly-named objects!
		jsep.noConflict = function() {
			if(root.jsep === jsep) {
				root.jsep = old_jsep;
			}
			return jsep;
		};
	} else {
		// In Node.JS environments
		if (typeof module !== 'undefined' && module.exports) {
			exports = module.exports = jsep;
		} else {
			exports.parse = jsep;
		}
	}
}(this));

},{}],2:[function(require,module,exports){
var errorUtil = require('./errorUtil');

module.exports = (function () {

    return {

        processAnnotations: function(controller, arrAnnotationListeners) {

            function processTreeRecursively(
                    controllerSubtree,
                    arrAnnotationListeners,
                    result,
                    keysFromRootToHere
            ) {
                var subtreePropertyName,
                    subtreePropertyValue,
                    metadata,
                    strFunctionName;

                for (subtreePropertyName in controllerSubtree) {
                    if (controllerSubtree.hasOwnProperty(subtreePropertyName)) {

                        subtreePropertyValue = controllerSubtree[subtreePropertyName];

                        keysFromRootToHere.push(subtreePropertyName);

                        if ($.isPlainObject(subtreePropertyValue)) {
                            processTreeRecursively(
                                subtreePropertyValue,
                                arrAnnotationListeners,
                                result,
                                keysFromRootToHere
                            );

                        } else if ($.isFunction(subtreePropertyValue)) {
                            metadata = {};
                            strFunctionName = undefined;
                            $.each(
                                keysFromRootToHere,
                                function(idxAnnotation, key) {
                                    var keyTrimmed = $.trim(key),
                                        annotation;
                                    if (keyTrimmed.charAt(0) === '@') {
                                        annotation = keyTrimmed;
                                        $.each(
                                            arrAnnotationListeners,
                                            function (idxListener, listener) {
                                                listener(
                                                    annotation,
                                                    subtreePropertyValue,
                                                    metadata
                                                );
                                            }
                                        );
                                    } else {
                                        if (strFunctionName) {
                                            throw errorUtil.createError(
                                                "Function name already specified; " +
                                                    "unexpected key: '" + strFunctionName + "'."
                                            );
                                        }
                                        strFunctionName = keyTrimmed;
                                    }
                                }
                            );

                            if (strFunctionName) {
                                result[strFunctionName] = {
                                    metadata: metadata,
                                    code: subtreePropertyValue
                                };
                            }

                            // if (!strFunctionName) {
                            //     throw errorUtil.createError(
                            //         "Function name not specified for: " + subtreePropertyValue
                            //     );
                            // }

                        }

                        keysFromRootToHere.pop();

                    }
                }
            }

            var result = {};
            processTreeRecursively(controller, arrAnnotationListeners, result, []);
            return result;

    }

    };

}());
},{"./errorUtil":6}],3:[function(require,module,exports){
var jsep = require('jsep'),
    errorUtil = require('./errorUtil'),
    sanityCheck = require('./sanityCheck');

jsep.addBinaryOp("|||", 10);
jsep.addBinaryOp("#", 10);
jsep.addBinaryOp("@", 10);

module.exports = {};

module.exports.newContext = function newContext(
        model,
        controller,
        controllerMethods,
        loopContextMemento
) {

    var my = {
            model: model,
            controller: controller,
            controllerMethods: controllerMethods,
            loopVariables:
                (loopContextMemento && loopContextMemento.loopVariables) ?
                    loopContextMemento.loopVariables : {},
            loopStatuses:
                (loopContextMemento && loopContextMemento.loopStatuses) ?
                    loopContextMemento.loopStatuses : {}
        },
        that = {};

    /*
     * PRIVATE FUNCTIONS:
     */

    function hasValue(value) {
        return (value !== undefined) && (value !== null);
    }

    function gsVariable(strName, valueToSet, adHocValue, forceSet) {

        var valueToReturn,
            arrCollection,
            index;

        if (my.loopVariables[strName] !== undefined) {
            arrCollection = my.loopVariables[strName].underlyingCollection;
            index = my.loopVariables[strName].index;

            if (valueToSet === undefined) {
                valueToReturn = arrCollection[index];

            } else {
                arrCollection[index] = valueToSet;
            }

        } else if (my.loopStatuses[strName] !== undefined) {
            if (valueToSet === undefined) {
                valueToReturn =  my.loopStatuses[strName];
            }

        } else if (hasValue(my.model[strName])) {
            if (valueToSet === undefined) {
                valueToReturn = my.model[strName];
            } else {
                my.model[strName] = valueToSet;
            }

        } else {
            if (adHocValue !== undefined) {
                return (my.model[strName] = adHocValue);

            } else if (valueToSet !== undefined) {
                if (forceSet) {
                    my.model[strName] = valueToSet;
                } else {
                    throw errorUtil.createError("Invalid model variable: " + strName);
                }
            }
        }

        return valueToReturn;

    }

    function calculateBinary(leftValue, operator, rightValue) {

        switch (operator) {
            case "+":
                return leftValue + rightValue;

            case "-":
                return leftValue - rightValue;

            case "*":
                return leftValue * rightValue;

            case "/":
                return leftValue / rightValue;

            case "%":
                return leftValue % rightValue;

            case "<":
                return leftValue < rightValue;

            case "<=":
                return leftValue <= rightValue;

            case ">":
                return leftValue > rightValue;

            case ">=":
                return leftValue >= rightValue;

            case "===":
                return leftValue === rightValue;

            case "==":
                return leftValue === rightValue;

            case "!==":
                return leftValue !== rightValue;

            case "!=":
                return leftValue !== rightValue;

            case "&&":
                return leftValue && rightValue;

            case "||":
                return leftValue || rightValue;

        }
    }

    function calculateUnary(operator, argument) {

        switch (operator) {

            case "+":
                return argument;

            case "-":
                return -argument;

            case "!":
                return !argument;

        }
    }

    function callFunction(calleeObject, functionName, functionArguments) {
        var parentObject,
            fn,
            evaluatedArguments = [],
            idxArgument;

        if (calleeObject !== null && calleeObject !== undefined) {
            parentObject = calleeObject;
            fn = calleeObject[functionName];

        } else if (my.controllerMethods[functionName]) {
            parentObject = my.controller;
            fn = my.controllerMethods[functionName].code;

        } else if (my.model[functionName] instanceof Function) {
            parentObject = my.model;
            fn = my.model[functionName];

        } else {
            throw errorUtil.createError("Function not found: " + functionName);
        }

        for (idxArgument = 0; idxArgument < functionArguments.length; idxArgument += 1) {
            evaluatedArguments.push(gsAstValue(functionArguments[idxArgument]));
        }

        return fn.apply(parentObject, evaluatedArguments);
    }

    var AST_EVALUATORS = [

        // literal
        {
            condition: function(ast) {
                return ast.type === "Literal";
            },

            getter: function (ast) {
                return ast.value;
            }
        },

        // variable name
        {
            condition: function(ast) {
                return ast.type === "Identifier";
            },

            getter: function(ast, adHocValue) {
                return gsVariable(ast.name, undefined, adHocValue);
            },

            setter: function(ast, value, forceSet) {
                gsVariable(ast.name, value, undefined, forceSet);
            }
        },

        // referring to an array member, e.g. "myArray[x + 3]"
        {
            condition: function(ast) {
                return ast.type === "MemberExpression" && ast.computed;
            },

            getter: function (ast, adHocValue) {
                var objectValue = gsAstValue(ast.object),
                    indexValue = gsAstValue(ast.property);

                sanityCheck.checkArraySanity(objectValue);

                if (hasValue(objectValue[indexValue])) {
                    return objectValue[indexValue];

                } else if (adHocValue !== undefined) {
                    return (objectValue[indexValue] = adHocValue);

                } else {
                    return undefined;
                }
            },

            setter: function(ast, value, forceSet) {
                var objectValue = gsAstValue(ast.object, undefined, forceSet ? [] : undefined),
                    indexValue = gsAstValue(ast.property);
                sanityCheck.checkArraySanity(objectValue);
                objectValue[indexValue] = value;
            }
        },

        // referring to an array member using and ad hoc operator, e.g. "myArray@(x + 3)"
        {
            condition: function(ast) {
                return ast.type === "BinaryExpression" && ast.operator === "@";
            },

            getter: function (ast, adHocValue) {
                var array =
                        gsAstValue(
                            ast.left,
                            undefined,
                            adHocValue !== undefined ? [] : undefined
                        ),
                    indexValue = gsAstValue(ast.right);

                if (array === undefined) {
                    return undefined;

                } else if (array === null) {
                    return null;

                } else {

                    if (!hasValue(array[indexValue]) && (adHocValue !== undefined)) {
                        array[indexValue] = adHocValue;
                    }

                    return array[indexValue];

                }
            },

            setter: function(ast, value) {
                var array = gsAstValue(ast.left, undefined, []);
                array[gsAstValue(ast.right)] = value;
            }
        },

        // referring to an object member, e.g. "myObj.x"
        {
            condition: function(ast) {
                return ast.type === "MemberExpression" && !(ast.computed);
            },

            getter: function (ast, adHocValue) {
                var objectValue = gsAstValue(ast.object),
                    propertyName = ast.property.name;

                sanityCheck.checkObjectSanity(objectValue);

                if (hasValue(objectValue[ast.property.name])) {
                    return objectValue[propertyName];

                } else if (adHocValue !== undefined) {
                    return (objectValue[propertyName] = adHocValue);

                } else {
                    return undefined;
                }
            },

            setter: function(ast, value, forceSet) {
                var objectValue = gsAstValue(ast.object, undefined, forceSet ? {} : undefined),
                    propertyName = ast.property.name;

                sanityCheck.checkObjectSanity(objectValue);

                objectValue[propertyName] = value;
            }
        },

        // referring to an object member where the object can be null, e.g. "myObj#x"
        {
            condition: function(ast) {
                return ast.type === "BinaryExpression" &&
                    ast.operator === "#" &&
                    ast.right &&
                    ast.right.type === "Identifier";
            },

            getter: function (ast, adHocValue) {

                var objectValue =
                        gsAstValue(
                            ast.left,
                            undefined,
                            adHocValue !== undefined ? {} : undefined
                        ),
                    propertyName = ast.right.name;

                if (objectValue === undefined) {
                    return undefined;

                } else if (objectValue === null) {
                    return null;

                } else {
                    if (!hasValue(objectValue[propertyName]) && (adHocValue !== undefined)) {
                        objectValue[propertyName] = adHocValue;
                    }

                    return objectValue[propertyName];
                }
            },

            setter: function(ast, value) {
                var objectValue = gsAstValue(ast.left, undefined, {});
                objectValue[ast.right.name] = value;
            }
        },

        // coalescence operator, e.g. "astCanBeNull ||| 'N/A'"
        {
            condition: function(ast) {
                return ast.type === "BinaryExpression" && ast.operator === "|||";
            },
            getter: function(ast, adHocValue) {
                var leftValue;

                if (adHocValue === undefined) {
                    leftValue = gsAstValue(ast.left);
                    return hasValue(leftValue) ? leftValue : gsAstValue(ast.right);

                } else {
                    return gsAstValue(ast.left, undefined, gsAstValue(ast.right));

                }
            },
            setter: function(ast, value) {
                gsAstValue(ast.left, value, undefined, true);
            }
        },

        // binary expression, including logical operators, e.g. "num + 1" or "a || b"
        {
            condition: function(ast) {
                return ast.type === "BinaryExpression" || ast.type === "LogicalExpression";
            },
            getter: function(ast) {
                return calculateBinary(
                    gsAstValue(ast.left),
                    ast.operator,
                    gsAstValue(ast.right)
                );
            }
        },

        // unary expression, e.g. "-x"
        {
            condition: function(ast) {
                return ast.type === "UnaryExpression";
            },
            getter: function(ast) {
                return calculateUnary(
                    ast.operator,
                    gsAstValue(ast.argument)
                );
            }
        },

        // ternary operator, e.g. "(a === 1) ? b : c"
        {
            condition: function(ast) {
                return ast.type === "ConditionalExpression";
            },
            getter: function(ast) {
                return gsAstValue(ast.test) ?
                    gsAstValue(ast.consequent) : gsAstValue(ast.alternate);
            }
        },

        // calling a function, e.g. "myFn(a, b, 2, 3)"
        {
            condition: function(ast) {
                return ast.type === "CallExpression";
            },
            getter: function(ast) {
                if (ast.callee.object !== null && ast.callee.object !== undefined) {
                    return callFunction(
                        gsAstValue(ast.callee.object),
                        ast.callee.property.name,
                        ast.arguments
                    );

                } else {
                    return callFunction(undefined, ast.callee.name, ast.arguments);
                }
            }
        }
    ];

    function gsAstValue(ast, valueToSet, adHocValue, forceSet) {

        var evaluatorIndex,
            currentEvaluator,
            matchingEvaluator,
            valueToReturn;

        for (evaluatorIndex = 0; evaluatorIndex < AST_EVALUATORS.length; evaluatorIndex += 1) {
            currentEvaluator = AST_EVALUATORS[evaluatorIndex];
            if (currentEvaluator.condition.call(currentEvaluator, ast)) {
                matchingEvaluator = currentEvaluator;
                break;
            }
        }

        if (!matchingEvaluator) {
            throw errorUtil.createError("Invalid expression." );
        }

        if (valueToSet === undefined) {
            return matchingEvaluator.getter.call(currentEvaluator, ast, adHocValue);

        } else if (matchingEvaluator.setter) {
            matchingEvaluator.setter.call(currentEvaluator, ast, valueToSet, forceSet);
        }

        /*
         * If the setter doesn't exist for the given expression type, don't do anything.
         * It means the expression is not a L-value, so we just ignore the write.
         */

    }

    function gsExpressionValue(strExpression, value, forceSet) {
        var ast = jsep(strExpression);
        return gsAstValue(ast, value, undefined, forceSet);
    }

    /*
     * PUBLIC FUNCTIONS:
     */


    /*
     * enterIteration:
     */
    that.enterIteration = function (
        strLoopVariableName,
        arrCollection,
        strStatusVariableName,
        intIndex
    ) {

        var bLoopVariableUsed,
            bStatusVariableUsed;

        // setting loop variable

        bLoopVariableUsed =
            my.loopVariables[strLoopVariableName] !== undefined ||
            my.loopStatuses[strLoopVariableName] !== undefined;

        if (bLoopVariableUsed) {
            throw errorUtil.createError("Loop variable '" + strLoopVariableName + "' is already used.");
        }

        my.loopVariables[strLoopVariableName] = {
            underlyingCollection: arrCollection,
            index: intIndex
        };


        // setting status variable

        if (strStatusVariableName !== undefined) {

            bStatusVariableUsed =
                my.loopStatuses[strStatusVariableName] !== undefined ||
                my.loopVariables[strStatusVariableName] !== undefined;

            if (bStatusVariableUsed) {
                throw errorUtil.createError(
                    "Loop status variable '" + strStatusVariableName + "' is already used."
                );
            }

            my.loopStatuses[strStatusVariableName] = {index: intIndex};
        }
    };


    /*
     * exitIteration:
     */
    that.exitIteration = function (
        strLoopVariableName,
        strStatusVariableName
    ) {

        my.loopVariables[strLoopVariableName] = undefined;
        if (strStatusVariableName !== undefined) {
            my.loopStatuses[strStatusVariableName] = undefined;
        }
    };

    /*
     * getValue:
     */
    that.getValue = function (strExpression) {
        return gsExpressionValue(strExpression);
    };

    /*
     * setValue:
     */
    that.setValue = function (strExpression, value, forceSet) {
        gsExpressionValue(strExpression, value, forceSet);
    };

    that.getLoopStatusesSnapshot = function () {
        return $.extend(true, {}, my.loopStatuses);
    };

    that.getLoopContextMemento = function() {
        var currentLoopVariable,
            loopVariablesSnapshot = {};

        for (currentLoopVariable in my.loopVariables) {
            if (my.loopVariables.hasOwnProperty(currentLoopVariable)) {
                loopVariablesSnapshot[currentLoopVariable] =
                    $.extend({}, my.loopVariables[currentLoopVariable]);
            }
        }

        return {
            loopVariables: loopVariablesSnapshot,
            loopStatuses: $.extend(true, {}, my.loopStatuses)
        };
    };

    that.newWithLoopContext = function (loopContextMemento) {
        return module.exports.newContext(
            my.model,
            my.controller,
            my.controllerMethods,
            loopContextMemento
        );
    };

    return that;

};
},{"./errorUtil":6,"./sanityCheck":16,"jsep":1}],4:[function(require,module,exports){
var virtualNodes = require('./virtualNodes');

module.exports = (function () {

    var VIEW_ROOT_ATTR_NAME = "data-_ylcViewRoot",
        VIEW_ROOT_ATTR_VALUE = "data-_ylcViewRoot",
        TEMPLATE_IDS_CHECKED_ATTR_NAME = "data-_ylcTemplateIdsChecked",
        TEMPLATE_IDS_CHECKED_ATTR_VALUE = "data-_ylcTemplateIdsChecked";

    return {
        markViewRoot: function(jqElement) {
            virtualNodes.getOriginal(jqElement).attr(VIEW_ROOT_ATTR_NAME, VIEW_ROOT_ATTR_VALUE);
        },

        unmarkViewRoot: function(jqElement) {
            virtualNodes.getOriginal(jqElement).removeAttr(VIEW_ROOT_ATTR_NAME);
        },

        isViewRoot: function(jqElement) {
            return (virtualNodes.getOriginal(jqElement).attr(VIEW_ROOT_ATTR_NAME) === VIEW_ROOT_ATTR_VALUE);
        },

        markTemplateIdsChecked: function(jqElement) {
            virtualNodes.getOriginal(jqElement).attr(TEMPLATE_IDS_CHECKED_ATTR_NAME, TEMPLATE_IDS_CHECKED_ATTR_VALUE);
        },

        areTemplateIdsChecked: function(jqElement) {
            return (virtualNodes.getOriginal(jqElement).attr(TEMPLATE_IDS_CHECKED_ATTR_NAME) === TEMPLATE_IDS_CHECKED_ATTR_VALUE);
        }

    };

}());
},{"./virtualNodes":20}],5:[function(require,module,exports){
var stringUtil = require("./stringUtil"),
    errorUtil = require("./errorUtil"),
    domAnnotator = require('./domAnnotator'),
    virtualNodes = require('./virtualNodes');

module.exports = (function () {

    function isDynamicallyGenerated(domElement) {
        var jqElement = $(domElement);
        return jqElement.hasClass("_ylcDynamicallyGenerated") ||
            jqElement.attr("data-_ylcDynamicallyGenerated") === "true";
    }

    function findIncludingRoot(jqElement, selector) {
        return jqElement.filter(selector).add(jqElement.find(selector));
    }

    function checkOrRewriteTemplateIds(jqTemplate, bReportErrorOnId, strRewriteIdsInTemplateTo) {
        var jqTemplateElementsWithIds;

        if (!domAnnotator.areTemplateIdsChecked(jqTemplate)) {
            jqTemplateElementsWithIds =  findIncludingRoot(jqTemplate, "[id]");
            if (jqTemplateElementsWithIds.length > 0) {
                if (bReportErrorOnId) {
                    throw errorUtil.createError(
                        "Loop templates cannot contain elements with IDs, " +
                        "because looping would create multiple elements with the same ID.",
                        jqTemplateElementsWithIds.get(0)
                    );
                } else {
                    jqTemplateElementsWithIds.each(function(){
                        var id = $(this).attr("id");
                        $(this).removeAttr("id");
                        $(this).attr(strRewriteIdsInTemplateTo, id);
                    });
                }
            }
            domAnnotator.markTemplateIdsChecked(jqTemplate);
        }
    }

    function reintroduceIdsInClonedSubtree(jqRoot, strRewriteIdsFrom) {
        var jqTemplateElementsWithIds = findIncludingRoot(jqRoot, "[" + strRewriteIdsFrom + "]");
        jqTemplateElementsWithIds.each(function() {
            $(this).attr("id", $(this).attr(strRewriteIdsFrom));
        });
    }

    function isTemplate(jqElement) {
        var strYlcLoop = stringUtil.strGetData(jqElement, "ylcLoop"),
            strIf = stringUtil.strGetData(jqElement, "ylcIf");

        if (!isDynamicallyGenerated(jqElement.get()) && jqElement.data("_ylcMetadata") && (jqElement.data("_ylcMetadata").ylcLoop || jqElement.data("_ylcMetadata").ylcIf)) {
            return true;
        }

        return (strYlcLoop || strIf) && !isDynamicallyGenerated(jqElement.get());
    }

    return {

        isDynamicallyGenerated: function (domElement) {
            return isDynamicallyGenerated(domElement);
        },

        makeTemplateVirtual: function(jqElement) {
            if (!isTemplate(jqElement)) {
                return jqElement;

            } else {
                return virtualNodes.makeVirtual(jqElement);
            }
        },

        isTemplate: function (domElement) {
            return isTemplate(virtualNodes.getOriginal($(domElement)));
        },

        jqCreateElementFromTemplate:
            function (jqTemplate, bReportErrorOnId, strRewriteIdsInTemplateTo) {

                var jqClone;

                checkOrRewriteTemplateIds(
                    jqTemplate,
                    bReportErrorOnId,
                    strRewriteIdsInTemplateTo
                );

                jqClone = jqTemplate.clone(true);
                jqClone.addClass("_ylcDynamicallyGenerated");
                jqClone.attr("data-_ylcDynamicallyGenerated", "true");
                domAnnotator.unmarkViewRoot(jqClone);

                reintroduceIdsInClonedSubtree(jqClone, strRewriteIdsInTemplateTo);

                return jqClone;
            }

    };

}());
},{"./domAnnotator":4,"./errorUtil":6,"./stringUtil":18,"./virtualNodes":20}],6:[function(require,module,exports){
module.exports = (function () {

    function createError(message, element) {
        var errorObject = new Error(message);
        errorObject.element = element;
        return errorObject;
    }

    return {

        createError: function(message, element) {
            return createError(message, element);
        },

        elementToError: function(error, element) {
            if (!error.element) {
                error.element = element;
            }
            return error;
        },

        printAndRethrow: function(error) {
            if (typeof console === 'object') {
                console.error(error);
                if (error.element !== undefined) {
                    console.log(error.element);
                }
                console.log("\n");
            }

            throw error;
        },

        assert: function(condition, message) {
            if (!condition) {
                throw createError("Assertion failed: " + message);
            }
        }

    };

}());
},{}],7:[function(require,module,exports){
var stringUtil = require('./stringUtil');

module.exports = (function () {

    return {

        process: function(string, arrTokenRecognizers) {
            var idxString = 0,
                nMatchedCharacters,
                idxTokenRecognizer,
                fnTokenRecognizer,
                bMatched;

            while (idxString < string.length) {
                bMatched = false;

                for (idxTokenRecognizer = 0;
                        idxTokenRecognizer < arrTokenRecognizers.length;
                        idxTokenRecognizer += 1) {
                    fnTokenRecognizer = arrTokenRecognizers[idxTokenRecognizer];
                    nMatchedCharacters = fnTokenRecognizer(string, idxString);
                    if (nMatchedCharacters > 0) {
                        idxString += nMatchedCharacters;
                        bMatched = true;
                        break;
                    }
                }

                if (!bMatched) {
                    throw "Unrecognized token in '" + string + "' at position " + idxString + ".";
                }
            }

        },

        onDefaultToken: function(callback) {
            return function(string, idxString) {
                if (callback) {
                    callback(string.substr(idxString, 1));
                }

                return 1;
            }
        },

        onConstantToken: function(token, callback) {
            return function(string, idxString) {

                if (!stringUtil.hasSubstringAt(string, token, idxString)) {
                    return 0;
                }

                if (callback) {
                    callback(token);
                }

                return token.length;
            };
        },

        onDelimitedToken: function(opening, closing, callback) {
            return function(string, idxString) {

                var idxOpening,
                    idxClosing,
                    lenToken,
                    strToken;

                if (!stringUtil.hasSubstringAt(string, opening, idxString)) {
                    return 0;
                }

                idxOpening = idxString;
                idxClosing = string.indexOf(closing, idxOpening + opening.length);

                if (idxClosing === -1) {
                    return 0;
                }

                lenToken = (idxClosing - idxOpening) + closing.length;
                strToken = string.substr(idxString, lenToken);

                if (callback) {
                    callback(strToken);
                }

                return lenToken;
            }
        },

        onCharacterSequence: function(arrCharactersInSequence, callback) {
            return function(string, idxString) {

                var idxStringOriginal = idxString,
                    idxStringCurrent = idxString,
                    strToken;

                while ($.inArray(string.charAt(idxStringCurrent), arrCharactersInSequence) !== -1) {
                    idxStringCurrent += 1;
                }

                strToken = string.substr(idxStringOriginal, idxStringCurrent - idxStringOriginal);

                if (idxStringCurrent > idxStringOriginal && callback) {
                    callback(strToken);
                }

                return strToken.length;

            }
        }

    };

}());
},{"./stringUtil":18}],8:[function(require,module,exports){
var domTemplates = require("../domTemplates"),
    stringUtil = require("../stringUtil"),
    ylcBindParser = require("../parser/ylcBind"),
    errorUtil = require("../errorUtil"),
    virtualNodes = require("../virtualNodes");

var PREFIELD = {};

function createM2v(currentYlcBinding) {

    return function (domElement, context) {

        var jqNode = $(domElement),
            value,
            existingValue;

        var fnGetterSetter = jqNode[currentYlcBinding.strPropertyName];
        if (!(fnGetterSetter instanceof Function)) {
            throw errorUtil.createError(
                "Cannot find jQuery getter/setter called '" +
                currentYlcBinding.strPropertyName + "'.",
                domElement
            );
        }

        try {
            value = context.getValue(currentYlcBinding.strBindingExpression);

        } catch (err) {
            throw errorUtil.elementToError(err, domElement);
        }

        if (value !== PREFIELD) {

            if (currentYlcBinding.strSubpropertyName === undefined) {
                existingValue = fnGetterSetter.call(jqNode);

            } else {
                existingValue =
                    fnGetterSetter.call(jqNode, currentYlcBinding.strSubpropertyName);
            }

            if (value !== existingValue) {
                if (currentYlcBinding.strSubpropertyName === undefined) {
                    fnGetterSetter.call(jqNode, value);

                } else {
                    fnGetterSetter.call(
                        jqNode,
                        currentYlcBinding.strSubpropertyName,
                        value
                    );
                }
            }
        }

    }
}

module.exports = {

    "@DomPreprocessorFactory": function() {

        return {
            nodeStart: function(jqNode, metadata) {

                metadata.m2v = metadata.m2v || [];

                var arrYlcBind = metadata.ylcBind,
                    idxYlcBind,
                    currentYlcBinding;

                for (idxYlcBind = 0; idxYlcBind < arrYlcBind.length; idxYlcBind += 1) {
                    currentYlcBinding = arrYlcBind[idxYlcBind];

                    if (currentYlcBinding.strMappingOperator !== ylcBindParser.MAPPING_BIDIRECTIONAL &&
                        currentYlcBinding.strMappingOperator !== ylcBindParser.MAPPING_M2V_ONLY) {
                        continue;
                    }

                    // an empty property maps straight to the DOM element, which is read only
                    if (stringUtil.isEmpty(currentYlcBinding.strPropertyName)) {
                        continue;
                    }

                    metadata.m2v.push(
                        createM2v(currentYlcBinding)
                    );

                }

                return false;
            },

            nodeEnd: function() {
                return false;
            }
        };
    },

    PREFIELD: PREFIELD

};
},{"../domTemplates":5,"../errorUtil":6,"../parser/ylcBind":13,"../stringUtil":18,"../virtualNodes":20}],9:[function(require,module,exports){
var domTemplates = require("../domTemplates"),
    stringUtil = require("../stringUtil"),
    ylcBindParser = require("../parser/ylcBind"),
    errorUtil = require("../errorUtil"),
    virtualNodes = require("../virtualNodes");

module.exports = {

    "@DomPreprocessorFactory": function() {

        return {
            nodeStart: function(jqNode, metadata) {
                var strYlcBind = stringUtil.strGetData(jqNode, "ylcBind");
                metadata.ylcBind = ylcBindParser.parseYlcBind(strYlcBind);
                jqNode.removeAttr("data-ylcBind");
                return false;
            },

            nodeEnd: function() {
                return false;
            }
        };
    }

};
},{"../domTemplates":5,"../errorUtil":6,"../parser/ylcBind":13,"../stringUtil":18,"../virtualNodes":20}],10:[function(require,module,exports){
var domTemplates = require("../domTemplates"),
    stringUtil = require("../stringUtil"),
    ylcBindParser = require("../parser/ylcBind"),
    errorUtil = require("../errorUtil"),
    virtualNodes = require("../virtualNodes");

function createV2m(currentYlcBinding) {

    return function (domElement, context) {

        var jqElement = $(domElement),
            value,
            fnGetter,
            forceSet =
                currentYlcBinding.strMappingOperator === ylcBindParser.MAPPING_V2M_ONLY_FORCED;

        if (stringUtil.isEmpty(currentYlcBinding.strPropertyName)) {
            value = jqElement.get();

        } else {
            fnGetter = jqElement[currentYlcBinding.strPropertyName];

            if (!fnGetter instanceof Function) {
                throw errorUtil.createError(
                    "Cannot find jQuery getter/setter called '" +
                    currentYlcBinding.strPropertyName + "'.",
                    jqElement.get()
                );
            }

            if (currentYlcBinding.strSubpropertyName === undefined) {
                value = fnGetter.call(jqElement);
            } else {
                value = fnGetter.call(jqElement, currentYlcBinding.strSubpropertyName);
            }
        }

        try {
            context.setValue(currentYlcBinding.strBindingExpression, value, forceSet);

        } catch (err) {
            throw errorUtil.elementToError(err, domElement);
        }

    }
}

module.exports = {

    "@DomPreprocessorFactory": function() {

        return {
            nodeStart: function(jqNode, metadata) {

                metadata.v2m = metadata.v2m || [];

                var arrYlcBind = metadata.ylcBind,
                    idxYlcBind,
                    currentYlcBinding;

                for (idxYlcBind = 0; idxYlcBind < arrYlcBind.length; idxYlcBind += 1) {
                    currentYlcBinding = arrYlcBind[idxYlcBind];

                    if (currentYlcBinding.strMappingOperator !== ylcBindParser.MAPPING_BIDIRECTIONAL &&
                        currentYlcBinding.strMappingOperator !== ylcBindParser.MAPPING_V2M_ONLY &&
                        currentYlcBinding.strMappingOperator !== ylcBindParser.MAPPING_V2M_ONLY_FORCED) {
                        continue;
                    }

                    metadata.v2m.push(
                        createV2m(currentYlcBinding)
                    );
                }

                return false;
            },

            nodeEnd: function() {
                return false;
            }
        };
    }

};
},{"../domTemplates":5,"../errorUtil":6,"../parser/ylcBind":13,"../stringUtil":18,"../virtualNodes":20}],11:[function(require,module,exports){
var errorUtil = require('../errorUtil'),
    parseUtil = require('../parseUtil'),
    domTemplates = require("../domTemplates"),
    ylcLoopParser = require('../parser/ylcLoop'),
    stringUtil = require("../stringUtil");

module.exports = {

    "@DomPreprocessorFactory": function() {
        return {
            nodeStart: function(jqNode, metadata) {

                var strYlcLoop = stringUtil.strGetData(jqNode, "ylcLoop"),
                    strYlcIf = stringUtil.strGetData(jqNode, "ylcIf");

                if (strYlcLoop && strYlcIf) {
                    throw errorUtil.createError(
                        "An element can't contain both data-ylcLoop and data-ylcIf. " +
                        "Please use an embedded DIV.",
                        jqNode
                    );
                }

                if (strYlcLoop) {
                    metadata.ylcLoop = ylcLoopParser.parseYlcLoop(strYlcLoop);

                } else if (strYlcIf) {
                    metadata.ylcIf = parseUtil.normalizeWhitespace(strYlcIf);

                } else {
                    return false;
                }

                jqNode.removeAttr("data-ylcLoop");
                jqNode.removeAttr("data-ylcIf");

                return true;

            },

            nodeEnd: function() {
                return false;
            }
        };
    }

};
},{"../domTemplates":5,"../errorUtil":6,"../parseUtil":12,"../parser/ylcLoop":15,"../stringUtil":18}],12:[function(require,module,exports){
var stringArrayBuilderFactory = require('./stringArrayBuilderFactory'),
    lexer = require('./lexer');

module.exports = (function () {

    return {

        split: function(string, strSeparator) {

            var stringArrayBuilder = stringArrayBuilderFactory.newStringArrayBuilder();

            lexer.process(
                string,
                [
                    lexer.onConstantToken(
                        strSeparator,
                        function(strToken) {
                            stringArrayBuilder.startNew();
                        }
                    ),

                    lexer.onDelimitedToken("/*", "*/"),

                    lexer.onDelimitedToken(
                        "'",
                        "'",
                        function(strToken) {
                            stringArrayBuilder.appendToCurrent(strToken)
                        }
                    ),

                    lexer.onDelimitedToken(
                        "\"",
                        "\"",
                        function(strToken) {
                            stringArrayBuilder.appendToCurrent(strToken)
                        }
                    ),

                    lexer.onCharacterSequence(
                        [' ', '\n', '\r', '\t'],
                        function(strToken) {
                            stringArrayBuilder.appendToCurrent(" ")
                        }
                    ),

                    lexer.onDefaultToken(
                        function(strToken) {
                            stringArrayBuilder.appendToCurrent(strToken)
                        }
                    )
                ]
            );

            return stringArrayBuilder.build();

        },

        normalizeWhitespace: function(string) {
            var sbResult = [];

            lexer.process(
                string,
                [

                    lexer.onDelimitedToken("/*", "*/"),

                    lexer.onDelimitedToken(
                        "'",
                        "'",
                        function(strToken) {
                            sbResult.push(strToken);
                        }
                    ),

                    lexer.onDelimitedToken(
                        "\"",
                        "\"",
                        function(strToken) {
                            sbResult.push(strToken);
                        }
                    ),

                    lexer.onCharacterSequence(
                        [' ', '\n', '\r', '\t'],
                        function(strToken) {
                            sbResult.push(" ");
                        }
                    ),

                    lexer.onDefaultToken(
                        function(strToken) {
                            sbResult.push(strToken)
                        }
                    )
                ]
            );

            return sbResult.join("");
        }

    };

}());
},{"./lexer":7,"./stringArrayBuilderFactory":17}],13:[function(require,module,exports){
var parseUtil = require("../parseUtil"),
    errorUtil = require('../errorUtil');

module.exports = (function () {

    var MAPPING_BIDIRECTIONAL = ":",
        MAPPING_V2M_ONLY = "->",
        MAPPING_V2M_ONLY_FORCED = "=>",
        MAPPING_M2V_ONLY = "<-";

    function poke(strSearchIn, intSearchAt, arrSearchFor) {
        var strSearchFor,
            idxSearchFor;

        for (idxSearchFor = 0; idxSearchFor < arrSearchFor.length; idxSearchFor += 1) {
            strSearchFor = arrSearchFor[idxSearchFor];
            if (strSearchIn.substr(intSearchAt, strSearchFor.length) === strSearchFor) {
                return strSearchFor;
            }
        }

        return "";

    }

    function pokeMappingOperator(strYlcBind, index) {
        return poke(
            strYlcBind,
            index,
            [
                MAPPING_BIDIRECTIONAL,
                MAPPING_V2M_ONLY,
                MAPPING_V2M_ONLY_FORCED,
                MAPPING_M2V_ONLY
            ]
        );
    }

    function readPropertyAndSubproperty(strYlcBind, index, sbPropertyAndSubproperty) {
        while (index < strYlcBind.length && pokeMappingOperator(strYlcBind, index) === "") {

            if (strYlcBind[index] === "\\" && index + 1 < strYlcBind.length) {
                sbPropertyAndSubproperty.push(strYlcBind[index + 1]);
                index += 2;

            } else {
                sbPropertyAndSubproperty.push(strYlcBind[index]);
                index += 1;
            }

        }

        if (index === strYlcBind.length) {
            throw errorUtil.createError("Premature end of binding expression: " + strYlcBind);
        }

        return index;
    }

    function readExpression(strYlcBind, index, sbExpression) {
        while (index < strYlcBind.length && strYlcBind[index] !== ";") {
            sbExpression.push(strYlcBind[index]);
            index += 1;
        }

        return index;
    }

    function parseBinding(strBinding) {
        var index = 0,
            sbPropertyAndSubproperty = [],
            strMappingOperator,
            sbExpression = [],
            strPropertyAndSubproperty,
            strPropertyName,
            strSubpropertyName;

        index = readPropertyAndSubproperty(strBinding, index, sbPropertyAndSubproperty);
        strMappingOperator = pokeMappingOperator(strBinding, index);
        index += strMappingOperator.length;
        readExpression(strBinding, index, sbExpression);

        strPropertyAndSubproperty = $.trim(sbPropertyAndSubproperty.join(""));

        if (strPropertyAndSubproperty.indexOf(".") < 0) {
            strPropertyName = strPropertyAndSubproperty;
            strSubpropertyName = undefined;

        } else {
            strPropertyName = $.trim(strPropertyAndSubproperty.split(".")[0]);
            strSubpropertyName = $.trim(strPropertyAndSubproperty.split(".")[1]);
        }

        return {
            strPropertyName: strPropertyName,
            strSubpropertyName: strSubpropertyName,
            strMappingOperator: strMappingOperator,
            strBindingExpression: $.trim(sbExpression.join(""))
        };
    }

    return {

        MAPPING_BIDIRECTIONAL: MAPPING_BIDIRECTIONAL,
        MAPPING_V2M_ONLY: MAPPING_V2M_ONLY,
        MAPPING_V2M_ONLY_FORCED: MAPPING_V2M_ONLY_FORCED,
        MAPPING_M2V_ONLY: MAPPING_M2V_ONLY,

        parseYlcBind: function(strYlcBind) {

            var result = [],
                bindings,
                idxBinding,
                strCurrentBinding;

            if (!strYlcBind) {
                return [];
            }

            bindings = parseUtil.split(strYlcBind, ";");

            for (idxBinding = 0; idxBinding < bindings.length; idxBinding += 1) {
                strCurrentBinding = bindings[idxBinding];
                if ($.trim(strCurrentBinding).length) {
                    result.push(parseBinding(strCurrentBinding));
                }
            }

            return result;

        }

    };

}());
},{"../errorUtil":6,"../parseUtil":12}],14:[function(require,module,exports){
var stringUtil = require("../stringUtil"),
    errorUtil = require('../errorUtil'),
    parseUtil = require('../parseUtil');

module.exports = (function () {

    return {

        parseYlcEvents: function(strYlcEvents) {
            if (!strYlcEvents) {
                return [];
            }

            var result = [],
                arrEvents = parseUtil.normalizeWhitespace(strYlcEvents).split(";"),
                index,

                strEvent,
                arrParts,
                strEventName,
                strHandler,
                idxArgumentListStart,
                strArgumentList,
                arrArgumentExpressions,
                strMethodName,

                idxEventNameHandlerSeparator;

            for (index = 0; index < arrEvents.length; index += 1) {
                strEvent = $.trim(arrEvents[index]);

                if (strEvent) {

                    idxEventNameHandlerSeparator = strEvent.indexOf(":");
                    if (idxEventNameHandlerSeparator === -1) {
                        throw errorUtil.createError(
                            "Invalid format of the data-ylcEvents parameter: " + strYlcEvents
                        );
                    }

                    strEventName = $.trim(strEvent.substr(0, idxEventNameHandlerSeparator));
                    strHandler =
                        $.trim(
                            strEvent.substr(
                                idxEventNameHandlerSeparator + 1,
                                strEvent.length - (idxEventNameHandlerSeparator + 1)
                            )
                        );

                    idxArgumentListStart = strHandler.indexOf("(");
                    if (idxArgumentListStart === -1) {
                        strMethodName = $.trim(strHandler);
                        arrArgumentExpressions = [];

                    } else {

                        if (strHandler.charAt(strHandler.length - 1) !== ')') {
                            throw errorUtil.createError(
                                "Invalid format of the data-ylcEvents parameter: " + strYlcEvents
                            );
                        }

                        strMethodName = $.trim(strHandler.substr(0, idxArgumentListStart));
                        strArgumentList =
                            $.trim(
                                strHandler.substr(
                                    idxArgumentListStart + 1,
                                    strHandler.length - idxArgumentListStart - 2
                                )
                            );

                        if (strArgumentList.length === 0) {
                            arrArgumentExpressions = [];
                        } else {
                            arrArgumentExpressions = parseUtil.split(strArgumentList, ",");
                        }
                    }

                    result.push({
                        strEventName: strEventName,
                        strMethodName: strMethodName,
                        arrArgumentExpressions: arrArgumentExpressions
                    });

                }
            }

            return result;
        }

    };

}());
},{"../errorUtil":6,"../parseUtil":12,"../stringUtil":18}],15:[function(require,module,exports){
var parseUtil = require("../parseUtil"),
    errorUtil = require('../errorUtil');

module.exports = (function () {

    return {

        parseYlcLoop: function (strYlcLoop) {
            var throwException = function () {
                    throw errorUtil.createError(
                        "Invalid format of the data-ylcLoop parameter: " + strYlcLoop
                    );
                },
                arrParts = parseUtil.normalizeWhitespace(strYlcLoop).split(":"),
                strLoopAndStatusVariables,
                strCollectionName,
                strLoopVariable,
                strStatusVariable,
                arrLoopAndStatusParts;

            if (arrParts.length !== 2) {
                throwException();
            }

            strLoopAndStatusVariables = $.trim(arrParts[0]);
            strCollectionName = $.trim(arrParts[1]);

            if (!strLoopAndStatusVariables || !strCollectionName) {
                throwException();
            }

            if (strLoopAndStatusVariables.indexOf(",") < 0) {
                strLoopVariable = strLoopAndStatusVariables;

            } else {
                arrLoopAndStatusParts = strLoopAndStatusVariables.split(",");
                if (arrLoopAndStatusParts.length !== 2) {
                    throwException();
                }
                strLoopVariable = $.trim(arrLoopAndStatusParts[0]);
                strStatusVariable = $.trim(arrLoopAndStatusParts[1]);
            }

            return {
                strLoopVariable: strLoopVariable,
                strStatusVariable: strStatusVariable,
                strCollectionName: strCollectionName
            };
        }

    };

}());
},{"../errorUtil":6,"../parseUtil":12}],16:[function(require,module,exports){
var errorUtil = require('./errorUtil');

module.exports = (function () {

    return {

        checkObjectSanity: function(objectValue) {
            if (objectValue === null || objectValue === undefined) {
                throw errorUtil.createError("Left hand side of the '.' operator must not be null/undefined.");
            }
        },

        checkArraySanity: function(arrayValue) {
            if (arrayValue === null || arrayValue === undefined) {
                throw errorUtil.createError("Left hand side of the '[]' operator must not be null/undefined.");
            }
        }

    };

}());
},{"./errorUtil":6}],17:[function(require,module,exports){
var stringUtil = require('./stringUtil');

module.exports = (function () {

    return {

        newStringArrayBuilder: function() {

            var sbCurrent = [],
                arrResult = [];

            return {

                appendToCurrent: function(strToAppend) {
                    sbCurrent.push(strToAppend);
                },

                startNew: function() {
                    arrResult.push(sbCurrent.join(""));
                    sbCurrent = [];
                },

                build: function() {
                    arrResult.push(sbCurrent.join(""));
                    return arrResult;
                }

            };

        }

    };

}());
},{"./stringUtil":18}],18:[function(require,module,exports){
module.exports = (function () {

    function hasSubstringAt(string, substring, index) {
        return string.substr(index, substring.length) === substring;
    }

    return {

        isEmpty: function(string) {
            return $.trim(string).length === 0;
        },

        strGetData: function(jqElement, strDataParameterName) {
            return jqElement.attr("data-" + strDataParameterName);
        },

        hasSubstringAt: function(string, substring, index) {
            return hasSubstringAt(string, substring, index);
        }

    };

}());
},{}],19:[function(require,module,exports){
var errorUtil = require('./errorUtil'),
    stringUtil = require('./stringUtil'),
    parseUtil = require('./parseUtil'),
    ylcBindParser = require('./parser/ylcBind'),
    domTemplates = require('./domTemplates'),
    ylcEventsParser = require('./parser/ylcEvents'),
    ylcLoopParser = require('./parser/ylcLoop'),
    domAnnotator = require('./domAnnotator'),
    contextFactory = require('./contextFactory'),
    annotationProcessor = require('./annotationProcessor'),
    virtualNodes = require('./virtualNodes'),
    micVirtualize = require('./mic/virtualizeTemplates'),
    micProcessBindingParameters = require('./mic/processBindingParameters'),
    micM2v = require('./mic/m2v'),
    micV2m = require('./mic/v2m');

module.exports = {};

module.exports.setupTraversal = function(pModel, pDomView, pController) {

    var EMPTY_FUNCTION = function () {},
        my = {};

    function m2vOnlyAnnotationListener(annotation, code, metadata) {
        if (annotation === "@M2vOnly") {
            metadata.m2vOnly = true;
        }
    }

    function beforeAfterEventAnnotationListener(annotation, code, metadata) {
        if (annotation === "@BeforeEvent") {
            my.callbacks.beforeEvent.push(code);

        } else if (annotation === "@AfterEvent") {
            my.callbacks.afterEvent.push(code);
        }
    }

    function domPreprocessAnnotationListener(annotation, code, metadata) {
        if (annotation === "@DomPreprocessorFactory") {
            my.callbacks.domPreprocessors.push(code());
        }
    }

    function extractControllerMethods(mixins, controller) {

        $.each(
            mixins,
            function(idx, mixin) {
                annotationProcessor.processAnnotations(
                    mixin,
                    [
                        m2vOnlyAnnotationListener,
                        beforeAfterEventAnnotationListener,
                        domPreprocessAnnotationListener
                    ]
                );
            }
        );

        return annotationProcessor.processAnnotations(
            controller,
            [
                m2vOnlyAnnotationListener,
                beforeAfterEventAnnotationListener,
                domPreprocessAnnotationListener
            ]
        );
    }

    function v2mSetValues(domElement) {

        var jqElement = $(domElement);

        if (jqElement.data("_ylcMetadata")) {
            $.each(
                jqElement.data("_ylcMetadata").v2m,
                function (idx, v2m) {
                    v2m(domElement, my.context);
                }
            );
        }

    }

    function getGeneratedElements(jqTemplate) {
        var domarrResult = [],
            jqCurrentSibling;

        jqCurrentSibling = jqTemplate;

        while (true) {
            jqCurrentSibling = jqCurrentSibling.next();

            if (jqCurrentSibling.get() === undefined || !domTemplates.isDynamicallyGenerated(jqCurrentSibling)) {
                break;
            }

            domarrResult.push(jqCurrentSibling.get());
        }

        return domarrResult;
    }

    function checkIterable(arrCollection) {
        if (!(arrCollection instanceof Array)) {
            throw errorUtil.createError(
                "Attempt to iterate through a non-array value: " +
                arrCollection
            );
        }
    }

    function v2mProcessDynamicElements(jqTemplate) {

        var metadata = virtualNodes.getOriginal(jqTemplate).data("_ylcMetadata");

        if (metadata.ylcLoop) {
            return v2mProcessDynamicLoopElements(jqTemplate);
        }

        if (metadata.ylcIf) {
            return v2mProcessDynamicIfElements(jqTemplate);
        }

        errorUtil.assert(false);

    }

    function v2mProcessElement(domElement) {
        var nElementsProcessed;

        if (domTemplates.isTemplate(domElement)) {
            nElementsProcessed = v2mProcessDynamicElements($(domElement), my.controller);

        } else if (domElement !== my.domView && domAnnotator.isViewRoot($(domElement))) {
            nElementsProcessed = 1;

        } else {
            v2mSetValues(domElement);
            v2mProcessChildren(domElement);
            nElementsProcessed = 1;
        }

        return nElementsProcessed;
    }

    function v2mProcessDynamicLoopElements(jqTemplate) {

        var idxWithinDynamicallyGenerated,
            ylcLoop = virtualNodes.getOriginal(jqTemplate).data("_ylcMetadata").ylcLoop,
            arrCollection = my.context.getValue(ylcLoop.strCollectionName),
            domarrGeneratedElements = getGeneratedElements(jqTemplate),
            domDynamicallyGeneratedElement,
            nProcessed;

        checkIterable(arrCollection);

        for (idxWithinDynamicallyGenerated = 0;
             idxWithinDynamicallyGenerated < domarrGeneratedElements.length;
             idxWithinDynamicallyGenerated += 1) {

            domDynamicallyGeneratedElement =
                domarrGeneratedElements[idxWithinDynamicallyGenerated];

            my.context.enterIteration(
                ylcLoop.strLoopVariable,
                arrCollection,
                ylcLoop.strStatusVariable,
                idxWithinDynamicallyGenerated
            );

            nProcessed = v2mProcessElement(domDynamicallyGeneratedElement);
            errorUtil.assert(
                nProcessed === 1,
                "A template can't be a dynamically generated element."
            );

            my.context.exitIteration(
                ylcLoop.strLoopVariable,
                ylcLoop.strStatusVariable
            );
        }

        return domarrGeneratedElements.length + 1;
    }

    function v2mProcessDynamicIfElements(jqTemplate) {
        var domarrCurrentGeneratedElements = getGeneratedElements(jqTemplate);

        if (domarrCurrentGeneratedElements.length > 0) {
            errorUtil.assert(domarrCurrentGeneratedElements.length === 1);
            v2mProcessElement(domarrCurrentGeneratedElements[0]);
        }

        return domarrCurrentGeneratedElements.length + 1;
    }

    function v2mProcessChildren(domElement) {
        var jqDomElement = $(domElement),
            jqsetChildren = jqDomElement.children(),
            index = 0,
            domChild;

        while (index < jqsetChildren.length) {
            domChild = jqsetChildren[index];
            index += v2mProcessElement(domChild);
        }
    }


    // propagating changes of model into view

    function m2vSetValues(domElement) {
        var jqElement = $(domElement);

        if (jqElement.data("_ylcMetadata")) {
            $.each(
                jqElement.data("_ylcMetadata").m2v,
                function (idx, m2v) {
                    m2v(domElement, my.context);
                }
            );
        }
    }

    function processCommonElements(
        ylcLoop,
        domarrCurrentGeneratedElements,
        arrCollection,
        commonLength
    ) {
        var index = 0,
            domGeneratedElement;

        while (index < commonLength) {
            domGeneratedElement = domarrCurrentGeneratedElements[index];

            my.context.enterIteration(
                ylcLoop.strLoopVariable,
                arrCollection,
                ylcLoop.strStatusVariable,
                index
            );

            index +=
                m2vProcessElement(
                    domGeneratedElement,
                    false
                );

            my.context.exitIteration(ylcLoop.strLoopVariable, ylcLoop.strStatusVariable);
        }
    }

    function addExtraElements(
        ylcLoop,
        jqTemplate,
        domarrCurrentGeneratedElements,
        arrCollection,
        commonLength
    ) {

        var jqLastCommonElement,
            jqLastElement,

            index,
            jqNewDynamicElement,
            elementsProcessed;

        if (commonLength === 0) {
            jqLastCommonElement = jqTemplate;
        } else {
            jqLastCommonElement = $(domarrCurrentGeneratedElements[commonLength - 1]);
        }

        jqLastElement = jqLastCommonElement;
        for (index = commonLength; index < arrCollection.length; index += 1) {

            jqNewDynamicElement =
                domTemplates.jqCreateElementFromTemplate(
                    virtualNodes.getOriginal(jqTemplate),
                    true
                );

            my.context.enterIteration(
                ylcLoop.strLoopVariable,
                arrCollection,
                ylcLoop.strStatusVariable,
                index
            );

            elementsProcessed =
                m2vProcessElement(jqNewDynamicElement.get(), true);
            errorUtil.assert(
                elementsProcessed === 1,
                "If an element is dynamically generated, it can't be a template."
            );

            my.context.exitIteration(ylcLoop.strLoopVariable, ylcLoop.strStatusVariable);

            jqLastElement.after(jqNewDynamicElement);
            jqLastElement = jqNewDynamicElement;

        }
    }

    function m2vProcessDynamicLoopElements(jqTemplate, ylcLoop) {

        var domarrCurrentGeneratedElements = getGeneratedElements(jqTemplate),
            arrCollection = my.context.getValue(ylcLoop.strCollectionName),
            commonLength,
            idxFirstToDelete,
            index;

        checkIterable(arrCollection);

        commonLength =
            Math.min(arrCollection.length, domarrCurrentGeneratedElements.length);

        processCommonElements(
            ylcLoop,
            domarrCurrentGeneratedElements,
            arrCollection,
            commonLength
        );

        if (arrCollection.length > commonLength) {
            addExtraElements(
                ylcLoop,
                jqTemplate,
                domarrCurrentGeneratedElements,
                arrCollection,
                commonLength
            );
        }

        if (domarrCurrentGeneratedElements.length > commonLength) {
            idxFirstToDelete = arrCollection.length;
            for (index = idxFirstToDelete;
                 index < domarrCurrentGeneratedElements.length;
                 index += 1) {
                $(domarrCurrentGeneratedElements[index]).remove();
            }
        }

        return domarrCurrentGeneratedElements.length + 1;
    }

    function m2vProcessDynamicIfElements(jqTemplate, strYlcIf) {
        var ifExpressionValue = my.context.getValue(parseUtil.normalizeWhitespace(strYlcIf)),
            domarrCurrentGeneratedElements = getGeneratedElements(jqTemplate),
            jqNewDynamicElement,
            nElementsProcessed;

        if (ifExpressionValue && domarrCurrentGeneratedElements.length === 0) {
            jqNewDynamicElement =
                domTemplates.jqCreateElementFromTemplate(
                    virtualNodes.getOriginal(jqTemplate),
                    false,
                    "_ylcId"
                );

            nElementsProcessed =
                m2vProcessElement(jqNewDynamicElement.get(), true);
            errorUtil.assert(
                nElementsProcessed === 1,
                "If an element is dynamically generated, it can't be a template."
            );

            jqTemplate.after(jqNewDynamicElement);

        } else if (domarrCurrentGeneratedElements.length > 0) {
            if (ifExpressionValue) {
                nElementsProcessed =
                    m2vProcessElement(
                        domarrCurrentGeneratedElements[0],
                        false
                    );

            } else {
                errorUtil.assert(domarrCurrentGeneratedElements.length === 1);
                $(domarrCurrentGeneratedElements[0]).remove();
            }

        }

        return domarrCurrentGeneratedElements.length + 1;

    }

    function m2vProcessDynamicElements(jqTemplate) {

        var metadata = virtualNodes.getOriginal(jqTemplate).data("_ylcMetadata");

        if (metadata.ylcLoop) {
            return m2vProcessDynamicLoopElements(jqTemplate, metadata.ylcLoop);
        }

        if (metadata.ylcIf) {
            return m2vProcessDynamicIfElements(jqTemplate, metadata.ylcIf);
        }

        errorUtil.assert(false);
    }

    function m2vProcessChildren(domElement, bBindEvents) {

        var jqElement = $(domElement),
            jqsetChildren = jqElement.children(),

            index,
            domChild;

        index = 0;

        while (index < jqsetChildren.length) {
            domChild = jqsetChildren[index];

            try {

                index +=
                    m2vProcessElement(
                        domChild,
                        bBindEvents
                    );

            } catch (err) {
                throw errorUtil.elementToError(err, domChild);
            }
        }

    }

    function callFunctions(arrCallbacks) {
        $.each(
            arrCallbacks,
            function (idx, fn) {
                fn.call(my.controller);
            }
        )
    }

    function evaluateArguments(arrArgumentExpressions, loopContextMemento) {

        var context = my.context.newWithLoopContext(loopContextMemento),
            idxArgument,
            arrEvaluatedExpressions = [];

        if (arrArgumentExpressions === null || arrArgumentExpressions === undefined) {
            return arrArgumentExpressions;
        }

        for (idxArgument = 0; idxArgument < arrArgumentExpressions.length; idxArgument += 1) {
            arrEvaluatedExpressions.push(context.getValue(arrArgumentExpressions[idxArgument]));
        }

        return arrEvaluatedExpressions;

    }

    function callModelUpdatingMethod(
            publicContext,
            fnUpdateMethod,
            m2vOnly,
            arrArgumentExpressions,
            loopContextMemento
    ) {

        var idxArgument,
            argumentValues = [my.model, publicContext],
            returnValue;

        if (arrArgumentExpressions) {

            Array.prototype.push.apply(
                argumentValues,
                evaluateArguments(arrArgumentExpressions, loopContextMemento)
            );

        }

        try {

            callFunctions(my.callbacks.beforeEvent);

            if (!m2vOnly) {
                v2mProcessElement(my.domView);
            }

            returnValue = fnUpdateMethod.apply(my.controller, argumentValues);

            m2vProcessElement(
                my.domView,
                false
            );

            callFunctions(my.callbacks.afterEvent);

        } catch (error) {
            errorUtil.printAndRethrow(error);
        }

        return returnValue;

    }

    function createHandler(publicContext, fnHandler, m2vOnly, arrArgumentExpressions, loopContextMemento) {
        return function (eventObject) {
            publicContext.eventObject = eventObject;
            return callModelUpdatingMethod(
                publicContext,
                fnHandler,
                m2vOnly,
                arrArgumentExpressions,
                loopContextMemento
            );
        };
    }

    function m2vBindEvents(domElement) {
        var jqElement = $(domElement),
            strYlcEvents = stringUtil.strGetData(jqElement, "ylcEvents"),
            arrYlcEvents = ylcEventsParser.parseYlcEvents(strYlcEvents),

            index,
            currentYlcEvent,
            fnHandler,
            publicContext,
            annotatedControllerFunction,

            m2vOnly,
            immediateCallArguments;

        for (index = 0; index < arrYlcEvents.length; index += 1) {
            currentYlcEvent = arrYlcEvents[index];
            m2vOnly = false;

            if (currentYlcEvent.strMethodName.length === 0) {
                fnHandler = EMPTY_FUNCTION;

            } else {
                annotatedControllerFunction = my.controllerMethods[currentYlcEvent.strMethodName];
                if (annotatedControllerFunction) {
                    fnHandler = annotatedControllerFunction.code;
                    if (annotatedControllerFunction.metadata.m2vOnly) {
                        m2vOnly = true;
                    }
                }
            }

            if (!(fnHandler instanceof Function)) {
                throw errorUtil.createError(
                    "Event handler '" + currentYlcEvent.strMethodName + "', " +
                    "specified for event '" + currentYlcEvent.strEventName + "', " +
                    "is not a function.",
                    domElement
                );
            }

            publicContext = createPublicContext(domElement);

            if (currentYlcEvent.strEventName === "ylcElementInitialized") {
                immediateCallArguments = [my.model, publicContext];
                if (currentYlcEvent.arrArgumentExpressions) {
                    Array.prototype.push.apply(
                        immediateCallArguments,
                        evaluateArguments(
                            currentYlcEvent.arrArgumentExpressions,
                            my.context.getLoopContextMemento()
                        )
                    );
                }
                fnHandler.apply(my.controller, immediateCallArguments);
            }

            jqElement.bind(
                currentYlcEvent.strEventName,
                createHandler(
                    publicContext,
                    fnHandler,
                    m2vOnly,
                    currentYlcEvent.arrArgumentExpressions,
                    my.context.getLoopContextMemento()
                )
            );
        }

    }

    function createPublicContext(domElement) {
        var publicContext = {};

        publicContext.PREFIELD = micM2v.PREFIELD;

        publicContext.domElement = domElement;
        publicContext.loopStatuses = my.context.getLoopStatusesSnapshot();
        publicContext.updateModel = function (fnUpdateMethod) {
            return callModelUpdatingMethod(publicContext, fnUpdateMethod);
        };

        return publicContext;
    }

    function m2vProcessElement(domElement, bBindEvents) {

        var nElementsProcessed;

        if (domTemplates.isTemplate(domElement)) {
            nElementsProcessed = m2vProcessDynamicElements($(domElement));

        } else if (domElement !== my.domView && domAnnotator.isViewRoot($(domElement))) {
            nElementsProcessed = 1;

        } else {
            if (bBindEvents) {
                m2vBindEvents(domElement);
            }
            m2vSetValues(domElement);
            m2vProcessChildren(domElement, bBindEvents);

            nElementsProcessed = 1;
        }

        return nElementsProcessed;
    }

    function getProperties(object) {
        var result = [],
            property;

        for (property in object) {
            if (object.hasOwnProperty(property)) {
                result.push(property);
            }
        }

        return result;
    }

    function createAdapter(domView, controller) {

        var adapter = {},
            controllerMethodNames = getProperties(controller),
            adapterMethodArguments;

        $.each(controllerMethodNames, function (idxProperty, currentMethodName) {
            var currentControllerMethod = controller[currentMethodName];

            if (currentControllerMethod instanceof Function) {
                adapter[currentMethodName] = function () {

                    var returnValue;

                    adapterMethodArguments =
                        [
                            my.model,
                            createPublicContext(null)
                        ];
                    $.each(arguments, function (index, argument) {
                        adapterMethodArguments.push(argument);
                    });

                    returnValue = currentControllerMethod.apply(controller, adapterMethodArguments);

                    m2vProcessElement(
                        domView,
                        false
                    );

                    return returnValue;
                };
            }

        });

        return adapter;
    }

    function processExternalEvent(domView, controller, communicationObject) {
        if (communicationObject.eventName === "getAdapter") {
            communicationObject.result = createAdapter(domView, controller);
        }
    }

    function registerYlcExternalEvent(domView, controller) {
        $(domView).bind(
            "_ylcExternalEvent",
            function (event, communicationObject) {
                processExternalEvent(domView, controller, communicationObject);
                return false;
            }
        );
    }

    function inOrderTraversal(jqNode, listeners) {

        var metadata = {},
            bMakeVirtual = false,
            jqVirtualNode;

        $.each(
            listeners,
            function (idx, listener) {
                bMakeVirtual |= listener.nodeStart(jqNode, metadata);
            }
        );

        if (bMakeVirtual) {
            jqVirtualNode = virtualNodes.makeVirtual(jqNode);
        }

        jqNode.children().each(
            function() {
                inOrderTraversal($(this), listeners);
            }
        );

        $.each(
            listeners,
            function (idx, listener) {
                listener.nodeEnd(jqNode, metadata);
            }
        );

        jqNode.data("_ylcMetadata", metadata);

        return jqVirtualNode ? jqVirtualNode : jqNode;

    }

    function setupViewForYlcTraversal() {

        domAnnotator.markViewRoot($(my.domView));

        if (my.controller.init instanceof Function) {
            my.controller.init.call(
                my.controller,
                my.model,
                createPublicContext(my.domView)
            );
        }

        m2vProcessElement(
            my.domView,
            true
        );

        registerYlcExternalEvent(my.domView, my.controller);

    }

    my.model = pModel;
    my.controller = pController;

    my.callbacks = {
        beforeEvent: [],
        afterEvent: [],
        domPreprocessors: []
    };

    my.controllerMethods = extractControllerMethods([micProcessBindingParameters, micVirtualize, micM2v, micV2m], my.controller);

    my.context = contextFactory.newContext(my.model, my.controller, my.controllerMethods);

    if (my.callbacks.domPreprocessors.length > 0) {
        my.domView = inOrderTraversal(pDomView, my.callbacks.domPreprocessors);
    }

    setupViewForYlcTraversal();

};

module.exports.triggerExternalEvent = function(domView, eventName, parameter) {

    var communicationObject = {
        eventName: eventName,
        parameter: parameter,
        result: undefined
    };

    $(domView).trigger("_ylcExternalEvent", communicationObject);

    return communicationObject.result;
};
},{"./annotationProcessor":2,"./contextFactory":3,"./domAnnotator":4,"./domTemplates":5,"./errorUtil":6,"./mic/m2v":8,"./mic/processBindingParameters":9,"./mic/v2m":10,"./mic/virtualizeTemplates":11,"./parseUtil":12,"./parser/ylcBind":13,"./parser/ylcEvents":14,"./parser/ylcLoop":15,"./stringUtil":18,"./virtualNodes":20}],20:[function(require,module,exports){
module.exports = (function () {

    function isVirtual(jqElement) {
        return jqElement.prop("tagName").toLowerCase() === "script" &&
            jqElement.attr("type") === "ylc/virtual";
    }

    return {

        makeVirtual: function(jqElement) {

            if (isVirtual(jqElement)) {
                return jqElement;
            }

            if (jqElement.data("virtualElement")) {
                return jqElement.data("virtualElement");
            }

            var virtualElement = $("<script type='ylc/virtual'></script>"),
                originalElement = jqElement.replaceWith(virtualElement);
            virtualElement.data("originalElement", originalElement);
            originalElement.data("virtualElement", virtualElement);
            return virtualElement;
        },

        getOriginal: function(jqElement) {
            if (isVirtual(jqElement)) {
                return jqElement.data("originalElement");
            } else {
                return jqElement;
            }
        },

        getVirtual: function(jqElement) {
            var jqVirtual;
            if (isVirtual(jqElement)) {
                return jqElement;
            } else {
                jqVirtual = jqElement.data("virtualElement");
                return jqVirtual ? jqVirtual : jqElement;
            }
        },

        isVirtual: function(jqElement) {
            return isVirtual(jqElement);
        }

    };

}());
},{}],21:[function(require,module,exports){
(function ($) {

    "use strict";

    var domAnnotator = require('./domAnnotator'),
        errorUtil = require('./errorUtil'),
        stringUtil = require('./stringUtil'),
        domTemplates = require('./domTemplates'),
        traversor = require('./traversor');

    $.fn.yellowCode = function (parameter1, parameter2, parameter3) {

        var domView = this,
            controller,
            objectToReturn,
            model;

        try {

            if (parameter1 instanceof Object) {
                model = {};
                controller = parameter1;

                traversor.setupTraversal(model, domView, controller);

                if (typeof parameter2 === "string") {
                    objectToReturn = traversor.triggerExternalEvent(domView, parameter2, parameter3);

                } else {
                    objectToReturn = this;
                }

            } else if (typeof parameter1 === "string") {
                if (!domAnnotator.isViewRoot($(domView))) {
                    throw errorUtil.createError(
                        "Cannot get an adapter. This element is not a YLC view root. " +
                        "Make sure Yellow Code has been properly initialized with this " +
                        "element as a view root.",
                        domView
                    );
                }
                objectToReturn = traversor.triggerExternalEvent(domView, parameter1, parameter2);
            }

            return objectToReturn;

        } catch (error) {
            errorUtil.printAndRethrow(error);
        }
    };

}(jQuery));

},{"./domAnnotator":4,"./domTemplates":5,"./errorUtil":6,"./stringUtil":18,"./traversor":19}]},{},[21]);
