(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var stringUtil = require("./stringUtil"),
    stringBuilderFactory = require("./stringBuilderFactory");

function newMatchResult(matchedLength, fnCallback) {
    return {
        matchedLength: matchedLength,
        fnCallback: fnCallback
    };
}

module.exports = (function () {

    return {

        process: function(string, arrTokenRecognizers, fnUnmatchedCallback) {
            var idxString = 0,
                matchResult,
                idxTokenRecognizer,
                fnTokenRecognizer,
                bMatched,
                sbUnmatched = stringBuilderFactory.newStringBuilder();

            function drainUnmatched() {
                if (sbUnmatched.isNotEmpty()) {
                    if (fnUnmatchedCallback) {
                        fnUnmatchedCallback(sbUnmatched.build());
                        sbUnmatched = stringBuilderFactory.newStringBuilder();
                    }
                }
            }

            while (idxString < string.length) {
                bMatched = false;

                for (idxTokenRecognizer = 0;
                        idxTokenRecognizer < arrTokenRecognizers.length;
                        idxTokenRecognizer += 1) {
                    fnTokenRecognizer = arrTokenRecognizers[idxTokenRecognizer];

                    matchResult = fnTokenRecognizer(string, idxString);

                    if (matchResult.matchedLength > 0) {

                        drainUnmatched();

                        if (matchResult.fnCallback) {
                            matchResult.fnCallback(string.substr(idxString, matchResult.matchedLength));
                        }
                        idxString += matchResult.matchedLength;
                        bMatched = true;
                        break;
                    }
                }

                if (!bMatched) {
                    if (fnUnmatchedCallback) {
                        sbUnmatched.append(string.substr(idxString, 1));
                        idxString += 1;
                    } else {
                        throw "Unrecognized token in '" + string + "' at position " + idxString + ".";
                    }
                }
            }

            drainUnmatched();

        },

        onDefaultToken: function(callback) {
            return function(string, idxString) {
                return newMatchResult(1, callback);
            }
        },

        onConstantToken: function(token, callback) {
            return function(string, idxString) {
                return newMatchResult(
                    stringUtil.hasSubstringAt(string, token, idxString) ? token.length : 0,
                    callback
                );
            };
        },

        onDelimitedToken: function(opening, closing, callback) {
            return function(string, idxString) {

                var idxOpening,
                    idxClosing,
                    lenToken;

                if (!stringUtil.hasSubstringAt(string, opening, idxString)) {
                    return newMatchResult(0, null);
                }

                idxOpening = idxString;
                idxClosing = string.indexOf(closing, idxOpening + opening.length);

                if (idxClosing === -1) {
                    return newMatchResult(0, null);
                }

                lenToken = (idxClosing - idxOpening) + closing.length;

                return newMatchResult(lenToken, callback);

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

                return newMatchResult(strToken.length, callback);
            }
        }

    };

}());
},{"./stringBuilderFactory":5,"./stringUtil":6}],2:[function(require,module,exports){
(function ($) {

    "use strict";

    $.nakedYellowCode = {
        lexer: require('./lexer'),
        stringUtil: require('./stringUtil'),
        stringArrayBuilderFactory: require('./stringArrayBuilderFactory'),
        parseUtil: require('./parseUtil')
    };

}(jQuery));

},{"./lexer":1,"./parseUtil":3,"./stringArrayBuilderFactory":4,"./stringUtil":6}],3:[function(require,module,exports){
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
},{"./lexer":1,"./stringArrayBuilderFactory":4}],4:[function(require,module,exports){
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
},{"./stringUtil":6}],5:[function(require,module,exports){
module.exports = {

    newStringBuilder: function() {

        var sb = [];

        return {

            append: function(strToAppend) {
                sb.push(strToAppend);
            },

            isNotEmpty: function() {
                return sb.length > 0;
            },

            build: function() {
                return sb.join("");
            }

        };

    }

};
},{}],6:[function(require,module,exports){
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
},{}]},{},[2]);
