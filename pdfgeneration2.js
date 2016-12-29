(function () {
    "use strict";

    var RenderUrlsToFile, system, url;

    system = require("system");

    RenderUrlsToFile = function (url, callbackPerQuestion, callbackFinal) {
        var getFilename, next, pdfGeneration, retrieve, waitFor, doTakeScreenshot, takeScreenshot, waitForLoading;
        var page = require('webpage').create();
        var args = system.args;
        if (args.length > 0) {
            console.log("yeah");
            args.forEach(function (arg, i) {
                console.log(i + ': ' + arg);
            });
        } else {
            console.log("damn");
        }

        var numberOfNav = args[2];
        var counter = 0;
        var timeout = numberOfNav * 4000;
        var renderDelay = 1000; //1000ms for rendering simple question, increase the number if necessary
        var startTime = (new Date()).getTime();
        page.onConsoleMessage = function (msg) {
            console.log(msg);
        };

        //    page.onResourceRequested = function (request) {
        //        console.log('Request ' + JSON.stringify(request, undefined, 4));
        //    };

        //    page.onResourceRequested = function(requestData, networkRequest) {
        //      var match = requestData.url.match(/wordfamily.js/g);
        //      if (match != null) {
        //        console.log('Request (#' + requestData.id + '): ' + JSON.stringify(requestData));
        //        networkRequest.cancel();
        //      }
        //    };

        page.paperSize = { format: 'A4', orientation: 'portrait', margin: '1cm',
                          header: {
                              height:"1cm",
                              contents: phantom.callback(function(pageNum, numPages) {
                                  return "<h3>Header <span style='float:right'>" + pageNum + " / " + numPages + "</span></h3>";
                              })
                          },
                          footer: {
                              height: "1cm",
                              contents: phantom.callback(function(pageNum, numPages) {
                                  return "<h3>Footer <span style='float:right'>" + pageNum + " / " + numPages + "</span></h3>";
                              })
                          }};

        retrieve = function() {
            return page.open(url, function(status) {

                if (!status) {
                    phantom.exit();
                    return;
                }

                if (status === "success") {
                    var file;

                    //hiding footer, header
                    page.includeJs('https://ajax.googleapis.com/ajax/libs/jquery/1.8.2/jquery.min.js', function() {
                        page.evaluate(function() {
                            console.log('INFO: hiding footer, header....');
                            jQuery('header[class^=header__header___]').hide();
                            jQuery('footer[class^=footer__footer_]').hide();
                            jQuery('div[class^=QuestionDisplay__footer_]').hide();
                            jQuery("html").height(0); //try to avoid the empty space in generated pdf -not sure if it works
                        });
                    });

                    getFilename = function() {
                        return "rendermulti-" + (counter + 1) + ".pdf";
                    };


                    file = getFilename();
                    console.log('INFO: successfully loaded! ' + page.url);

                    next = function(status, file) {
                        //reset startTime for the next question
                        startTime = (new Date()).getTime();
                        if (counter < numberOfNav-1) {
                            counter++;
                            console.log('INFO: navigate to the question: ' + (counter + 1) );
                            page.evaluate(function() {
                                jQuery(".btn--highlight").click();
                            });
                            return pdfGeneration();
                        }
                        return callbackFinal();
                    };

                    doTakeScreenshot = function(file) {
                        callbackPerQuestion(status, page, file, counter);
                        page.render(file);
                        console.log('INFO: phantomjs pdf generation took ' + ((new Date()).getTime() - startTime) + 'ms\n');
                        console.log('---------');
                        return next(status, file);
                    };

                    takeScreenshot = function(file) {
                        //here we define how long we should wait for a question to be rendered
                        console.log('checking to decide the time for rendering...');
                        var hasGeoGebra = page.evaluate(function(){
                            return document.querySelector('div[id^=ggbObject_]');
                        });
                        if (hasGeoGebra) {
                            console.log('INFO: geogebra - it will take a little bit more time to do rendering');
                            //TODO should use a wait function instead of just setting the timeout
                            window.setTimeout(function () {doTakeScreenshot(file);}, 3500);
                        } else {
                            console.log("no geogebra?");
                            //TODO should use a wait function instead of just setting the timeout
                            window.setTimeout(function () {doTakeScreenshot(file);}, renderDelay);
                        }
                    };

                    pdfGeneration = function() {
                        file = getFilename();
                        return takeScreenshot(file);
                    };

                    waitForLoading = function() {
                        //here we decide how long we should wait for questionset to be loaded,
                        //before we take the first snapshot and navigate to the next question
                        page.evaluate(function() {
                            if (document.querySelector('div[class^=PDFPanelDisplay__PDFPanel_]') !== null) {
                                console.log('INFO: hiding pdfviewer');
                                jQuery('div[class^=PDFPanelDisplay__PDFPanel_]').hide();
                            }
                        });

                        var hasIllustration = page.evaluate(function () {
                            return document.querySelector('#illustration') !== null;
                        });

                        var hasPdf = page.evaluate(function() {
                            return document.querySelector('div[class^=PDFPanelDisplay__PDFPanel_]');
                        });

                        //remove the pdf viewer, if there is one
                        if (hasPdf) {
                            system.stderr.write('INFO: The question has an pdf, remove it? OK?');
                            page.evaluate(function() {
                                jQuery('div[class^=PDFPanelDisplay__PDFPanel_]').hide();
                            });
                        }

                        var hasGeoGebra = page.evaluate(function() {
                            return document.querySelector('div[id^=ggbObject_]');
                        });

                        //checking for code wrapper - programming question
                        var hasCodeWrapper = page.evaluate(function() {
                            console.log('INFO: checking if there is a code wrapper--------');
                            return document.querySelector('div[class^=codeWrapper__codeWrapper_]');
                        });

                        if (hasGeoGebra) {
                            //wait a little bit here
                            console.log('INFO: has geogebra, what should we do?');
                            //TODO handling the geogebra - wait a little bit
                        }
                        if (hasCodeWrapper) {
                            //wait a little bit here
                            console.log('INFO: code wrapper detected---------');
                            //TODO handling the codewrapper - wait a little bit
                        }

                        return pdfGeneration();
                    };

                    return waitForLoading();
                } else {
                    return callbackFinal();
                }
            });
        };
        return retrieve();
    };

    url = system.args[1];

    RenderUrlsToFile(url, (function(status, page, file, counter) {
        console.log("INFO: you never come here?");
        if (status !== "success") {
            return console.log("Unable to render '" + page.url + "'");
        } else {
            console.log('INFO: taking snapshot for item: ' + (counter + 1));
            return console.log("INFO: Rendered '" + page.url + "' at '" + file + "'");
        }
    }), function() {
        //TODO merge all the generated pdf files into one file
        return phantom.exit();
    });
})();
