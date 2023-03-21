// jshint esversion:6

const express = require("express");
const ejs = require("ejs");
const bodyParser = require("body-parser");
const _ = require("lodash");
const mongoose = require("mongoose");
const { text } = require("body-parser");
const { indexOf } = require("lodash");

mongoose.set('strictQuery', true);
mongoose.connect("mongodb://localhost:27017/studyTrackerDB", { useNewUrlParser: true });

const activitySchema = new mongoose.Schema({
    item: String,
    minutes: Number
});

const postSchema = new mongoose.Schema({
    date: Date,
    activity: [activitySchema]
});

const Post = mongoose.model("Post", postSchema);

const app = express();
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));


app.get("/", function (req, res) {
    let currentDate = new Date();
    var today = new Date();
    var dd = String(today.getDate()).padStart(2, '0');
    var mm = String(today.getMonth() + 1).padStart(2, '0');
    var mm2 = String(today.getMonth() + 2).padStart(2, '0');
    var yy = today.getFullYear();
    var monthBegin = yy + "-" + mm + "-" + "01";
    var monthEnd = yy + "-" + mm2 + "-" + "01";
    today = yy + "-" + mm + "-" + dd;
    var dailyTotal = 0;
    var monthlyTotal = 0;
    const monthDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let dailyGoal = Math.round(2250 / (monthDays[currentDate.getMonth()]));

    async function calcDailyTotal() {
        try {
            const doc = await Post.find({ date: today });
            doc[0].activity.forEach(function (items) {
                dailyTotal += items.minutes;
                return dailyTotal;
            })
        }
        catch (err) {
            console.log(err);
        }

        try {
            const doc2 = await Post.find({ date: { "$gte": monthBegin, "$lt": monthEnd } });
            doc2.forEach(function (dailyRecord) {
                dailyRecord.activity.forEach(function (items) {
                    monthlyTotal += items.minutes;
                    return monthlyTotal;
                })
            })
        }
        catch (err) {
            console.log(err);
        }
        res.render("home", { dailyTotal: dailyTotal, dailyGoal: dailyGoal, monthlyTotal: monthlyTotal });
    };

    calcDailyTotal();
}
);


app.post("/dailyInput", function (req, res) {
    Post.findOne({ date: req.body.dateInput, "activity.item": req.body.activityInput }, function (err, result) {
        if (err) {
            console.log(err);
        } else if (result !== null) {
            Post.findOneAndUpdate({ date: req.body.dateInput, "activity.item": req.body.activityInput }, { $inc: { "activity.$.minutes": req.body.minutesInput } },
                function (err, doc) {
                    if (err) {
                        console.log(err);
                    } else {
                        return doc;
                    }
                }); // end of first scenario.  date and activity exists.  
        } else {
            Post.findOne({ date: req.body.dateInput }, function (err, result) {
                if (err) {
                    console.log(err);
                } else if (result !== null) {
                    const resultingDoc = result;
                    resultingDoc.activity.push({ item: req.body.activityInput, minutes: req.body.minutesInput });
                    resultingDoc.save(function (err) {
                        if (err) {
                            console.log(err);
                        } else {
                            return resultingDoc;
                            console.log(resultingDoc);
                        }
                    }); // end of second scenario. Adding activity to existing date.   
                } else {
                    const post = new Post({
                        date: req.body.dateInput,
                        activity: []
                    });
                    post.activity.push({ item: req.body.activityInput, minutes: req.body.minutesInput });
                    post.save(function (err, result) {
                        if (err) {
                            console.log(err);
                        } else {
                            return result;
                        }
                    })
                }
            }) // This is the end of the second Post.find request/function.
        }
    }); // This is the end of the first Post.find request/function.
    res.redirect("/");
}); // This is the end of app.post



app.get("/daily", function (req, res) {
    res.render("daily", { dailyTotal: dailyTotal, dailyGoal: dailyGoal });
})

app.listen(4000, function () {
    console.log("Server started on port 4000.")
});
