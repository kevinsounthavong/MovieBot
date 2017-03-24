'use strict';

let restify = require('restify')
    //Include the library botbuilder
let builder = require('botbuilder')

//Create the server
let server = restify.createServer()

//Run the server continuously
server.listen(3978, function() {
    console.log('The server is running on ', server.name, server.url)
})

// Create chat connector with the default id and password
let connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
})

//When the server posts to /api/messages, make the connector listen to it.
server.post('/api/messages', connector.listen())

let bot = new builder.UniversalBot(connector, [
    function(session) {
        session.send("Hello, I'm a movie bot!");
        session.beginDialog('rootMenu');
    },
    function(session, results) {
        session.endConversation("Goodbye!");
    }
]);

//add root menu Dialog
bot.dialog('rootMenu', [
    function(session) {
        builder.Prompts.choice(session, "Choose an option:", "Search Movie|Search TV Show|Quit");
    },
    function(session, results) {
        switch (results.response.index) {
            case 0:
                session.beginDialog('searchMovie');
                break;
            case 1:
                session.beginDialog('searchTV');
                break;
            default:
                session.endDialog();
                break;
        }
    },
    function(session) {
        //Reload menu
        session.replaceDialog('rootMenu');
    }
]).reloadAction('showMenu', null, { matches: /^(menu|back)/i });

var apiKey = 'f46da2d24ce4a9b7d333411d76d33bc0';
var Client = require('node-rest-client').Client;
var baseURL = 'https://api.themoviedb.org/3';

// direct way
var client = new Client();


//Search for movie title
bot.dialog('searchMovie', [getTitle, confirmTitle, searchMovie]);

function getTitle(session) {
    builder.Prompts.text(session, "What is the movie's title?");
}

//Store the title inside session.userData.title where title is our apiKey
function confirmTitle(session, results) {
    session.userData.title = results.response;
    builder.Prompts.confirm(session, "OK! You want me to search for " + session.userData.title + ". Is this correct? (Yes or No)");
}

var async = require('async');

function searchMovie(session, results) {
    let query = session.userData.title;
    let endPoint = '/search/movie';
    let url = baseURL + endPoint + "?api_key=" + apiKey + "&query=" + query;

    console.log("URL = " + url);

    var movies = [];
    var cards = [];
    var imdbURLs = [];
    var reply;
    var baseIMDB = 'http://www.imdb.com/title/';
    var pageIMDB;

    async.waterfall([
        function(callback) {
            client.get(url, function(data, response) {
                movies = data.results;
                callback(null, movies);
            });
        },
        function(movieList, callback) {
            async.eachSeries(movieList, function(item, cb) {

                console.log("Movie Title: " + item.original_title);
                var id = item.id;

                var title = item.original_title;
                var date = item.release_date;
                var overview = item.overview;
                var posterURL = item.poster_path;
                var imageURL = 'http://image.tmdb.org/t/p/w185//' + posterURL;

                client.get(baseURL + "/movie/" + id + "?api_key=" + apiKey, function(data, response) {
                    pageIMDB = baseIMDB + data.imdb_id + '/';
                    imdbURLs.push(pageIMDB);
                    console.log("pageIMDB = " + pageIMDB)

                    var card = new builder.HeroCard(session)
                        .title(title)
                        .subtitle(date)
                        .text(overview)
                        .images([
                            builder.CardImage.create(session, imageURL)
                        ])
                        .buttons([
                            builder.CardAction.openUrl(session, pageIMDB, 'IMDB Page'),
                            builder.CardAction.dialogAction(session, "info", title, "Ask me!")
                        ])

                    cards.push(card);
                    cb();
                });
            }, function(error) {
                callback(null, cards);
            });
        },
        function(cardList, callback) {

            console.log("Card LIST = " + cardList)

            // create reply with Carousel AttachmentLayout
            reply = new builder.Message(session)
                .attachmentLayout(builder.AttachmentLayout.carousel)
                .attachments(cardList);

            callback(null, reply);
        }
    ], function(err, result) {
        session.send(result);
        session.endDialog("Result(s) returned!");
    });
}

var LUIS_MODEL_URL = "https://westus.api.cognitive.microsoft.com/luis/v2.0/apps/57f90955-7f77-4505-bacc-c703fb2f2df5?subscription-key=3ec130c93aac432d99d4e4d32c2c8ce9&staging=true&verbose=true&q=";

var recognizer = new builder.LuisRecognizer(LUIS_MODEL_URL);
//bot.recognizer(recognizer);
var dialog = new builder.IntentDialog({ recognizers: [recognizer] });
bot.dialog('/info', dialog);

//add intent handlers
dialog.matches('SearchCast', builder.DialogAction.send('SearchCast calling'));
dialog.matches('SearchCrew', builder.DialogAction.send('SearchCrew calling'));
dialog.onDefault(builder.DialogAction.send('Sorry. I did not understand what you said.'));
/*
//Create a dialog and bind it to a global action
bot.dialog('/info', [
    function(session, args, next) {
        builder.Prompts.text(session, "What do you want to know about " + args.data + "?");
        //session.endDialog("You wanted to know more about the movie %s!", args.data);
        //Try extracting entites

        var movieComponentEntity = builder.EntityRecognizer.findEntity(args.intent.entities, 'MovieComponent');
        var personEntity = builder.EntityRecognizer.findEntity(args.intent.entities, 'Person');
        var actionEntity = builder.EntityRecognizer.findEntity(args.intent.entities, 'action');

        session.endDialog('Found these entities! movieComponentEntity = ' + movieComponentEntity + ': personEntity = ' + personEntity + ': ' + 'actionEntity = ' + actionEntity);
    }

]);*/

bot.beginDialogAction('info', '/info');