(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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
},{"./stringUtil":5}],2:[function(require,module,exports){
(function ($) {

    "use strict";

    $.nakedYellowCode = {
        lexer: require('./lexer'),
        stringUtil: require('./stringUtil'),
        stringArrayBuilderFactory: require('./stringArrayBuilderFactory'),
        parseUtil: require('./parseUtil')
    };

}(jQuery));

},{"./lexer":1,"./parseUtil":3,"./stringArrayBuilderFactory":4,"./stringUtil":5}],3:[function(require,module,exports){
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
},{"./stringUtil":5}],5:[function(require,module,exports){
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
