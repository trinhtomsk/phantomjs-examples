var cluster = require("cluster");
if (cluster.isMaster) {
    var cpuCount = require('os').cpus().length;

    for (var i = 0; i < cpuCount; i++) {
        console.log('Forking process #' + (i + 1));
        cluster.fork();
    }

    cluster.on('exit', function (worker) {
        console.log('Worker ' + worker.id + ' died. Forking...');
        cluster.fork();
    });

} else {
    var phantom = require("phantom"),
    express = require("express"),
    serve = express();

    setupPage = function(page) {
        page.property('paperSize',
        { format: 'A4', orientation: 'portrait', margin: '1cm'});
    };

    serve.get('/generatepdf', function (req, res) {
        console.log(req.url);
        var url = req.query.url;
        var numberOfQuestions = req.query.numberOfQuestions;
        var counter = 0;
        var renderDelay = 1000;
        var startTime = (new Date()).getTime();
        console.log(url  + '\t' + numberOfQuestions);

        console.log('The worker ' + process.pid + ' is handling the job.');

        phantom.create().then(function (ph) {
            ph.createPage().then(function (page) {

                page.setting('userAgent', 'PDF Generator App');

                page.open(url).then(function (status) {
                    if (!status) {
                        ph.exit();
                        return;
                    }

                    if (status === "success") {
                        var file;

                        //hiding footer, header

                        getFilename = function() {
                            return process.pid + '-' + (new Date()).getTime() + '-' + (counter + 1) + '.pdf';
                        };


                        file = getFilename();
                        console.log('INFO: successfully loaded! ' + url);

                        next = function(status, file) {
                            //reset startTime for the next question
                            startTime = (new Date()).getTime();
                            if (counter < numberOfQuestions-1) {
                                counter++;
                                console.log('INFO: about to move on the next question: ' + (counter + 1) + ' ' + process.pid );
                                page.evaluate(function() {
                                    document.querySelector(".btn--highlight").click();
                                }).then(function(){
                                    console.log('INFO: Moving to the next question...');
                                    return pdfGeneration();
                                });

                            } else {
                                res.json({
                                    processPID: process.pid,
                                    pageStatus: status
                                });
                                page.close();
                                ph.exit();
                            }

                        };

                        doTakeScreenshot = function(file) {

                            page.render(file).then(function () {
                                console.log('INFO: phantomjs pdf generation took ' + ((new Date()).getTime() - startTime) + 'ms\n');
                                console.log('---------');
                                return next(status, file);
                            });
                        };

                        takeScreenshot = function(file) {
                            //here we define how long we should wait for a question to be rendered
                            console.log('checking to decide the time for rendering...');
                            page.evaluate(function() {
                                console.log('INFO: checking if question has pdf attached.');
                                return document.querySelector('div[class^=PDFPanelDisplay__PDFPanel_]');
                            }).then(function (hasPdf) {
                                if (hasPdf) {
                                    console.log('INFO: The question has an pdf, remove it? OK?');
                                    page.includeJs('https://ajax.googleapis.com/ajax/libs/jquery/1.8.2/jquery.min.js').then(function() {
                                        page.evaluate(function() {
                                            jQuery('div[class^=PDFPanelDisplay__PDFPanel_]').hide();
                                        }).then(function () {
                                            console.log('INFO: Just hide the PDF.');
                                        });
                                    });

                                } else {
                                    console.log('INFO: No pdf attached found');
                                }
                            });


                            doTakeScreenshot(file);
                        };

                        pdfGeneration = function() {
                            file = getFilename();
                            return takeScreenshot(file);
                        };

                        return pdfGeneration();

                    }
                    //page.render(process.pid + '-'+ (new Date()).getTime() + '.pdf');

                });
            });
        });
    }).listen(3333);
}
