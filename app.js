// jshint esversion:6

const express = require("express");
const ejs = require("ejs");
const bodyParser = require("body-parser");
const _ = require("lodash");
const mongoose = require("mongoose");
const { text } = require("body-parser");
const { indexOf } = require("lodash");
const { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format, addHours } = require("date-fns");

const annualTarget = 27000;
const monthlyTarget = 2250;

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
    var yearBegin = yy + "-" + "01-01";
    today = yy + "-" + mm + "-" + dd;
    var dailyTotal = 0;
    var monthlyTotal = 0;
    var monthlyPlusMinus = 0;
    var annualPlusMinus = 0;
    var actualYTDMinutes = 0;
    var avgMonthlyCatchup = 0;
    const monthDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let dailyGoal = Math.round(monthlyTarget / (monthDays[currentDate.getMonth()]));

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
        try {
            monthlyPlusMinus = monthlyTotal - Math.round((monthlyTarget / (monthDays[currentDate.getMonth()])) * dd);
        }
        catch (err) {
            console.log(err);
        }
        try {
            const now = new Date();
            const startOfYear = new Date(now.getFullYear(), 0, 0);
            const diff = now - startOfYear;
            const oneDay = 1000 * 60 * 60 * 24;
            const dayNumberOfYear = Math.floor(diff / oneDay);
            const targetYTDMinutes = Math.floor((annualTarget / 365) * dayNumberOfYear);
            const doc3 = await Post.find({ date: { "$gte": yearBegin, "$lte": today } });
            doc3.forEach(function (dailyRecord) {
                dailyRecord.activity.forEach(function (items) {
                    actualYTDMinutes += items.minutes;
                    return actualYTDMinutes;
                })
            })
            annualPlusMinus = actualYTDMinutes - targetYTDMinutes;
        }
        catch (err) {
            console.log(err);
        }
        try {
            var daysInMonth = monthDays[currentDate.getMonth()];
            avgMonthlyCatchup = Math.floor((monthlyTarget - monthlyTotal) / (daysInMonth - dd + 1));
        }
        catch (err) {
            console.log(err);
        }



        res.render("home", {
            dailyTotal: dailyTotal, dailyGoal: dailyGoal,
            monthlyTotal: monthlyTotal, monthlyPlusMinus: monthlyPlusMinus,
            annualPlusMinus: annualPlusMinus, avgMonthlyCatchup: avgMonthlyCatchup
        });
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

app.get("/dailyInputPrompt", function (req, res) {
    res.render("dailyInputPrompt");
});

app.post("/dailyAnalysis", function (req, res) {
    let inputDate = new Date(req.body.dateInput);
    let currentDate = new Date();
    var today = new Date();
    var adjustedInputDate = addHours(inputDate, +5);
    var dd = String(adjustedInputDate.getDate()).padStart(2, '0');
    var mm = String(adjustedInputDate.getMonth() + 1).padStart(2, '0');
    var mm2 = String(adjustedInputDate.getMonth() + 2).padStart(2, '0');
    var yy = adjustedInputDate.getFullYear();
    var formattedDate = mm + "/" + dd + "/" + yy;
    var monthBegin = yy + "-" + mm + "-" + "01";
    var monthEnd = yy + "-" + mm2 + "-" + "01";
    var yearBegin = yy + "-" + "01-01";
    today = yy + "-" + mm + "-" + dd;
    var dailyTotal = 0;
    var monthlyTotal = 0;
    var monthlyPlusMinus = 0;
    var annualPlusMinus = 0;
    var actualYTDMinutes = 0;
    var avgMonthlyCatchup = 0;
    var activityArray = [];
    const monthDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let dailyGoal = Math.round(monthlyTarget / (monthDays[inputDate.getMonth()]));

    async function calcDailyTotal() {
        try {
            const doc = await Post.find({ date: inputDate });
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
        try {
            monthlyPlusMinus = monthlyTotal - Math.round((monthlyTarget / (monthDays[currentDate.getMonth()])) * dd);
        }
        catch (err) {
            console.log(err);
        }
        try {
            const now = new Date();
            const startOfYear = new Date(now.getFullYear(), 0, 0);
            const diff = now - startOfYear;
            const oneDay = 1000 * 60 * 60 * 24;
            const dayNumberOfYear = Math.floor(diff / oneDay);
            const targetYTDMinutes = Math.floor((annualTarget / 365) * dayNumberOfYear);
            const doc3 = await Post.find({ date: { "$gte": yearBegin, "$lte": today } });
            doc3.forEach(function (dailyRecord) {
                dailyRecord.activity.forEach(function (items) {
                    actualYTDMinutes += items.minutes;
                    return actualYTDMinutes;
                })
            })
            annualPlusMinus = actualYTDMinutes - targetYTDMinutes;
        }
        catch (err) {
            console.log(err);
        }
        try {
            var daysInMonth = monthDays[currentDate.getMonth()];
            avgMonthlyCatchup = Math.floor((monthlyTarget - monthlyTotal) / (daysInMonth - dd + 1));
        }
        catch (err) {
            console.log(err);
        }

        try {
            const activityDoc = await Post.find({ date: inputDate });
            activityArray = activityDoc[0];
        }
        catch (err) {
            console.log(err);
        }

        res.render("dailyAnalysis", {
            formattedDate: formattedDate, dailyTotal: dailyTotal, dailyGoal: dailyGoal,
            activityArray: activityArray
        });
    };

    calcDailyTotal();
});

// Weekly Analysis
app.get("/weeklyInputPrompt", function (req, res) {
    res.render("weeklyInputPrompt");
});

app.post("/weeklyAnalysis", function (req, res) {
    let inputDate = new Date(req.body.dateInput);
    let firstDay;
    let lastDay;
    const finalArray = [];
    async function getWeeklyFigures() {
        const adjustedInputDate = addHours(inputDate, +5);
        firstDay = startOfWeek(adjustedInputDate);
        lastDay = endOfWeek(adjustedInputDate);
        const adjustedFirstDay = addHours(firstDay, -5);
        const adjustedLastDay = addHours(lastDay, -5);
        // Will these "-5"s need to change with daylight savings?  
        var dd = String(firstDay.getDate()).padStart(2, '0');
        var dd2 = String(lastDay.getDate()).padStart(2, '0');
        var mm = String(firstDay.getMonth() + 1).padStart(2, '0');
        var mm2 = String(lastDay.getMonth() + 1).padStart(2, '0');
        var yy = firstDay.getFullYear();
        var yy2 = lastDay.getFullYear();
        var firstDayDate = yy + "-" + mm + "-" + dd;
        var lastDayDate = yy + "-" + mm + "-" + dd2;
        var formattedfirstDay = mm + "/" + dd + "/" + yy;
        var formattedlastDay = mm2 + "/" + dd2 + "/" + yy2;

        try {
            const weeklyArray = await Post.find({
                date: {
                    "$gte": adjustedFirstDay, "$lte": adjustedLastDay
                }
            });
            const consolidatedArray = [];
            function ActivityObject(task, time) {
                this.activity = task;
                this.minutes = time;
            }
            weeklyArray.forEach(function (dailyRecord) {
                dailyRecord.activity.forEach(function (eachActivity) {
                    let newActivity = new ActivityObject(eachActivity.item, eachActivity.minutes);
                    consolidatedArray.push(newActivity);
                })
            })

            consolidatedArray.forEach(function (eachItem) {
                if (finalArray.length === 0) {
                    finalArray.push(eachItem);
                } else {
                    if (!finalArray.some(e => e.activity === eachItem.activity)) {
                        finalArray.push(eachItem);
                    } else {
                        var index = finalArray.findIndex(p => p.activity === eachItem.activity);
                        finalArray[index].minutes += eachItem.minutes;
                    }
                }
            })
            var weeklyTotal = 0;
            finalArray.forEach(function (activityObject) {
                weeklyTotal += activityObject.minutes;
            })
        }
        catch (err) {
            console.log(err);
        }

        res.render("weeklyAnalysis", {
            formattedfirstDay: formattedfirstDay, formattedlastDay: formattedlastDay,
            finalArray: finalArray, weeklyTotal: weeklyTotal
        });
    };
    getWeeklyFigures();
});

// Monthly Analysis
app.get("/monthlyInputPrompt", function (req, res) {
    res.render("monthlyInputPrompt");
});

app.post("/monthlyAnalysis", function (req, res) {
    let currentDate = new Date();
    let inputDate = new Date(req.body.dateInput);
    let firstDay;
    let lastDay;
    const finalArray = [];

    async function getMonthlyFigures() {
        const adjustedInputDate = addHours(inputDate, +5);
        firstDay = startOfMonth(adjustedInputDate);
        lastDay = endOfMonth(adjustedInputDate);
        const adjustedFirstDay = addHours(firstDay, -5);  // used in the db search.
        const adjustedLastDay = addHours(lastDay, -5);  // used in the db search.
        const monthNames = ["January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"];
        const month = adjustedInputDate.getMonth();
        const monthName = monthNames[month];
        const relativeYear = adjustedInputDate.getFullYear();

        try {
            const monthlyArray = await Post.find({ date: { "$gte": adjustedFirstDay, "$lte": adjustedLastDay } });
            const consolidatedArray = [];
            function ActivityObject(task, time) {
                this.activity = task;
                this.minutes = time;
            };
            monthlyArray.forEach(function (dailyRecord) {
                dailyRecord.activity.forEach(function (eachActivity) {
                    let newActivity = new ActivityObject(eachActivity.item, eachActivity.minutes);
                    consolidatedArray.push(newActivity);
                })
            })
            consolidatedArray.forEach(function (eachItem) {
                if (finalArray.length === 0) {
                    finalArray.push(eachItem);
                } else {
                    if (!finalArray.some(e => e.activity === eachItem.activity)) {
                        finalArray.push(eachItem);
                    } else {
                        var index = finalArray.findIndex(p => p.activity === eachItem.activity);
                        finalArray[index].minutes += eachItem.minutes;
                    }
                }
            })
            var monthlyTotal = 0;
            finalArray.forEach(function (activityObject) {
                monthlyTotal += activityObject.minutes;
            })
            var monthlyTotalPercent = Math.round((monthlyTotal / monthlyTarget) * 100);
            const monthDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
            let dailyGoal = Math.round(monthlyTarget / (monthDays[currentDate.getMonth()]));
            var dd = String(currentDate.getDate()).padStart(2, '0');

            var ifCurrentMonth = String(currentDate.getMonth()).padStart(2, '0');
            var ifInputMonth = String(adjustedInputDate.getMonth()).padStart(2, '0');
            var expectedProgress;
            if (ifCurrentMonth > ifInputMonth) {
                expectedProgress = 2250;
            } else {
                expectedProgress = dailyGoal * dd;
            }
            var expectedProgPlusMinus = monthlyTotal - expectedProgress;


        }
        catch (err) {
            console.log(err);
        }

        res.render("monthlyAnalysis", {
            inputDate: inputDate, monthName: monthName, relativeYear: relativeYear,
            monthlyTotal: monthlyTotal, monthlyTotalPercent: monthlyTotalPercent,
            expectedProgress: expectedProgress, expectedProgPlusMinus: expectedProgPlusMinus,
            finalArray: finalArray
        });
    };
    getMonthlyFigures();
});


// Yearly Analysis
app.get("/yearlyInputPrompt", function (req, res) {
    res.render("yearlyInputPrompt");
});

app.post("/yearlyAnalysis", function (req, res) {
    let yearSelected = req.body.selectedYear;
    let beginningYear = yearSelected + "-01-01";
    let endingYear = yearSelected + "-12-31";
    let beginningYearDate = new Date(beginningYear);
    let endingYearDate = new Date(endingYear);
    let begMonthDay = [];
    let endMonthDay = [];
    let finalArray = [];
    let currentDate = new Date();
    let minutesBehind;

    async function getAnnualFigures() {

        try {
            const annualArray = await Post.find({
                date: {
                    "$gte": beginningYearDate,
                    "$lte": endingYearDate
                }
            });
            const consolidatedYearlyArray = [];
            function ActivityObject(task, time) {
                this.activity = task;
                this.minutes = time;
            };
            annualArray.forEach(function (dailyRecord) {
                dailyRecord.activity.forEach(function (eachActivity) {
                    let newActivity = new ActivityObject(eachActivity.item, eachActivity.minutes);
                    consolidatedYearlyArray.push(newActivity);
                })
            })

            consolidatedYearlyArray.forEach(function (eachItem) {
                if (finalArray.length === 0) {
                    finalArray.push(eachItem);
                } else {
                    if (!finalArray.some(e => e.activity === eachItem.activity)) {
                        finalArray.push(eachItem);
                    } else {
                        var index = finalArray.findIndex(p => p.activity ===
                            eachItem.activity);
                        finalArray[index].minutes += eachItem.minutes;
                    }
                }
            })
            var yearlyTotal = 0;
            finalArray.forEach(function (activityObject) {
                yearlyTotal += activityObject.minutes;
            })
            var yearlyTotalPercentage = Math.round((yearlyTotal / annualTarget) * 100);

            var monthDates = ["-01-01", "-02-01", "-03-01", "-04-01", "-05-01", "-06-01",
                "-07-01", "-08-01", "-09-01", "-10-01", "-11-01", "-12-01", "-12-31"];
            var indivMonthsArray = [];
            var indivMonthsMinutes = [];

            for (let i = 0; i <= 11; i++) {
                if (i <= 10) {
                    var gtDate = yearSelected + monthDates[i];
                    var ltDate = yearSelected + monthDates[i + 1];
                    const oneMonthArray = await Post.find({
                        date: { "$gte": gtDate, "$lt": ltDate }
                    });
                    indivMonthsArray.push(oneMonthArray);

                } else if (i === 11) {
                    var gtDate = yearSelected + monthDates[11];
                    var ltDate = yearSelected + monthDates[12];
                    const decemberArray = await Post.find({
                        date: { "$gte": gtDate, "$lte": ltDate }
                    })
                    indivMonthsArray.push(decemberArray);
                }
            }

            indivMonthsArray.forEach(function (eachMonthArray) {
                var monthTotalMinutes = 0;
                eachMonthArray.forEach(function (eachDayObject) {
                    eachDayObject.activity.forEach(function (eachActivity) {
                        monthTotalMinutes += eachActivity.minutes;
                    })
                })
                indivMonthsMinutes.push(monthTotalMinutes);
            })
            // add code to get the minutes behind calculation here.
            const dayOfYear = date =>
                Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
            const dayOfTheYear = dayOfYear(new Date());
            const currentYear = currentDate.getFullYear();
            if (currentYear > yearSelected) {
                minutesBehind = annualTarget - yearlyTotal;
                console.log(minutesBehind);
            } else if (currentYear == yearSelected) {
                minutesBehind = Math.floor(((annualTarget / 365) * dayOfTheYear) - yearlyTotal);
                console.log(minutesBehind);
            } else {
                minutesBehind = 0;
            };
        }
        catch (err) {
            console.log(err);
        }
        res.render("yearlyAnalysis", {
            yearSelected: yearSelected, yearlyTotal: yearlyTotal,
            yearlyTotalPercentage: yearlyTotalPercentage,
            indivMonthsMinutes: indivMonthsMinutes, minutesBehind: minutesBehind
        });
    }
    getAnnualFigures();
});



app.listen(4000, function () {
    console.log("Server started on port 4000.")
});
