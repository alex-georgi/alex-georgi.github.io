// Areas
var svg = d3.select("svg");
var bars = svg.select("#bars");
var xaxisArea = svg.select("#xaxisArea");
var labels = svg.select("#labels");
var tooltips = d3.select("#tooltips");
var generationLabel = svg.select("#generationLabel");
var hint = d3.select("#hint");

// Sizing Stuff
var margin = 50;
var chartWidth = svg.attr("width") - 2 * margin;
var chartHeight = svg.attr("height") - 2 * margin;

// Global Vars
let generationData;
let colorMapper;
let xscale;
let yscale;
let xaxis;
var numFrames = 30;
var currentGen = 1;
var minGen = 1;
var maxGen = 9;

d3.csv("data.csv")
	.then((data) => {
		data.forEach((row) => {
			row["Units Sold (millions)"] = +row["Units Sold (millions)"];
			row.Generation = +row.Generation;
		});

		generationData = d3.group(data, (row) => row.Generation);

		updateButtonStatus();
		initializeChart();
		generateChart(0, currentGen);

		setTimeout(() => hint.style("opacity", 1).style("pointer-events", "auto"), 5000);
		hint.on("click", () => {
			hint.style("opacity", 0).style("pointer-events", "none");
		});

		d3.select("#previousButton").on("click", () => {
			if (currentGen > minGen) {
				generateChart(currentGen, currentGen - 1);
				currentGen--;
			}
			updateButtonStatus();
		});

		d3.select("#nextButton").on("click", () => {
			if (currentGen < maxGen) {
				generateChart(currentGen, currentGen + 1);
				currentGen++;
			}
			updateButtonStatus();
		});
	})
	.catch(function (error) {
		console.error("That's not good:", error);
	});

function updateButtonStatus() {
	d3.select("#previousButton").property("disabled", currentGen <= minGen);
	d3.select("#nextButton").property("disabled", currentGen >= maxGen);
}

function initializeChart() {
	if (bars.empty()) {
		bars = svg
			.append("g")
			.attr("id", "bars")
			.attr("transform", `translate(${margin}, ${margin})`)
			.attr("fill-opacity", 0.7);
	}

	if (xaxisArea.empty()) {
		xaxisArea = svg
			.append("g")
			.attr("id", "xaxisArea")
			.attr("transform", `translate(${margin}, ${margin})`);
		xaxisArea
			.append("text")
			.attr("x", chartWidth / 2)
			.attr("y", -20)
			.attr("fill", "#000")
			.attr("text-anchor", "middle")
			.text("Total Console Sales");
	}

	if (labels.empty()) {
		labels = svg
			.append("g")
			.attr("id", "labels")
			.attr("transform", `translate(${margin}, ${margin})`)
			.attr("text-anchor", "end");
	}

	if (generationLabel.empty()) {
		generationLabel = svg
			.append("text")
			.attr("id", "generationLabel")
			.attr("x", margin + chartWidth / 2)
			.attr("y", margin + chartHeight)
			.attr("text-anchor", "middle");
	}

	generationLabel
		.append("tspan")
		.attr("class", "generation")
		.attr("x", margin + chartWidth / 2)
		.style("font-weight", "bold");

	generationLabel
		.append("tspan")
		.attr("class", "yearRange")
		.attr("x", margin + chartWidth / 2)
		.attr("dy", "1.2em");

	xscale = d3.scaleLinear().range([0, chartWidth]);

	yscale = d3.scaleBand().range([0, chartHeight]).padding(0.15);

	xaxis = d3
		.axisTop(xscale)
		.ticks(chartWidth / 200)
		.tickSizeOuter(0)
		.tickSizeInner(-1 * chartHeight)
		.tickFormat((tick) => d3.format(",")(tick * 1000000));

	colorMapper = d3
		.scaleOrdinal()
		.domain([
			"Magnavox",
			"Atari",
			"Mattel",
			"Nintendo",
			"Sega",
			"Sony",
			"Microsoft",
		])
		.range([
			"#b40000",
			"#5a3a22",
			"#d4af37",
			"#e60012",
			"#ff9900",
			"#003087",
			"#0e7a0d",
		]);
}

async function generateChart(startGen, endGen) {
	updateGenerationLabel(endGen);

	var keyframes = generateKeyframes(startGen, endGen);
	for (var keyframe of keyframes) {
		var transition = svg.transition().duration(250).ease(d3.easeLinear);

		updateScales(keyframe);
		updateBars(keyframe, transition);
		updateAxis(transition);
		updateLabels(keyframe, transition);
		await transition.end();
	}
}

function generateKeyframes(startGen, endGen) {
	var companies = generateCompanies(startGen, endGen);

	var startData = generateSalesMap(companies, startGen);
	var endData = generateSalesMap(companies, endGen);

	keyframes = [];

	for (var currFrame = 0; currFrame < numFrames; currFrame++) {
		var progress = currFrame / numFrames;
		keyframe = generateRanking(
			companies,
			(company) =>
				startData.get(company).Sales * (1 - progress) +
				endData.get(company).Sales * progress,
			endData
		);
		keyframes.push(keyframe);
	}

	lastKeyframe = generateRanking(
		companies,
		(company) => endData.get(company).Sales,
		endData
	);
	lastKeyframe = lastKeyframe.filter((element) => element.Sales !== 0);
	keyframes.push(lastKeyframe);

	return keyframes;
}

function generateCompanies(startGen, endGen) {
	var companies = new Set();

	if (startGen !== 0) {
		generationData
			.get(startGen)
			.forEach((element) => companies.add(element.Company));
	}

	generationData
		.get(endGen)
		.forEach((element) => companies.add(element.Company));

	return companies;
}

function generateSalesMap(companies, generation) {
	var salesMap = new Map();

	if (generation === 0) {
		companies.forEach((company) => {
			salesMap.set(company, { Sales: 0, Console: "", Tooltip: "" });
		});
		return salesMap;
	}

	salesData = generationData.get(generation);

	companies.forEach((company) => {
		var consoleData = salesData.find((element) => element.Company === company);
		var sales = consoleData ? consoleData["Units Sold (millions)"] : 0;
		var console = consoleData ? consoleData["Console"] : "";
		var tooltip = consoleData ? consoleData["Tooltip"] : "";
		salesMap.set(company, { Sales: sales, Console: console, Tooltip: tooltip });
	});

	return salesMap;
}

function generateRanking(companies, getSales, endData) {
	var ranking = [];

	companies.forEach((company) =>
		ranking.push({
			Company: company,
			Sales: getSales(company),
			Console: endData.get(company).Console,
			Tooltip: endData.get(company).Tooltip,
		})
	);

	ranking.sort((a, b) => d3.descending(a.Sales, b.Sales));

	for (var i = 0; i < companies.size; i++) {
		ranking[i].Rank = i;
	}

	return ranking;
}

function updateGenerationLabel(generation) {
	generationLabel.select("tspan.generation").text(`Generation ${generation}`);

	generationLabel
		.select("tspan.yearRange")
		.text(generationData.get(generation)[0]["Gen Years"]);
}

function updateScales(keyframe) {
	xscale.domain([0, d3.max(keyframe, (element) => element.Sales) || 0.001]);
	yscale.domain(d3.range(keyframe.length));
}

function updateBars(keyframe, transition) {
	console.log(keyframe);

	var barData = bars
		.selectAll("rect")
		.data(keyframe, (element) => element.Company);

	// 1. Remove bars that don't exist in keyframe
	barData.exit().transition(transition).attr("width", xscale(0)).remove();

	// 2. Transition bars that exist in both keyframes
	barData
		.transition(transition)
		.attr("y", (element) => yscale(element.Rank))
		.attr("width", (element) => xscale(element.Sales) - xscale(0))
		.attr("height", yscale.bandwidth());

	// 3. Insert bars that are new to the keyframe
	barData
		.enter()
		.append("rect")
		.attr("x", xscale(0))
		.attr("y", (element) => yscale(element.Rank))
		.attr("width", (element) => xscale(element.Sales) - xscale(0))
		.attr("height", yscale.bandwidth())
		.attr("fill", (element) => colorMapper(element.Company))
		.on("mouseover", (event, element) => {
			tooltips.style("opacity", 1).html(element.Tooltip);
		})
		.on("mousemove", (event) => {
			tooltips
				.style("left", event.pageX + "px")
				.style("top", event.pageY + "px");
		})
		.on("mouseleave", () => {
			tooltips.style("opacity", 0);
		});
}

function updateAxis(transition) {
	xaxisArea.transition(transition).call(xaxis);
	xaxisArea.select(".tick:first-of-type text").remove();
	xaxisArea
		.selectAll(".tick:not(:first-of-type) line")
		.attr("stroke", "#f8f9fa");
	xaxisArea.select(".domain").remove();
}

function updateLabels(keyframe, transition) {
	var labelData = labels.selectAll("text").data(keyframe, (d) => d.Company);

	// 1. Remove labels that don't exist in keyframe
	labelData.exit().remove();

	// 2. Transition labels that exist in both keyframes
	labelData
		.transition(transition)
		.attr(
			"transform",
			(element) =>
				`translate(${Math.max(xscale(element.Sales), 100)}, ${yscale(
					element.Rank
				)})`
		)
		.attr("y", yscale.bandwidth() / 2)
		.each(function (element) {
			var label = d3.select(this);

			label.select("tspan.Company").text(element.Company);
			if (element.Console !== "") {
				label.select("tspan.Console").text(element.Console);
			}
			label
				.select("tspan.Sales")
				.transition(transition)
				.tween("text", function () {
					var currVal = +this.textContent.replace(/,/g, "");
					var interpolator = d3.interpolate(currVal, element.Sales * 1000000);
					return function (t) {
						this.textContent = d3.format(",.0f")(interpolator(t));
					};
				});
		});

	// 3. Insert labels that are new to the keyframe
	labelData
		.enter()
		.append("text")
		.attr(
			"transform",
			(element) =>
				`translate(${Math.max(xscale(element.Sales), 100)}, ${yscale(
					element.Rank
				)})`
		)
		.attr("y", yscale.bandwidth() / 2)
		.each(function (element) {
			var label = d3.select(this);

			label
				.append("tspan")
				.attr("class", "Company")
				.attr("x", -10)
				.attr("dy", "-1em")
				.style("font-weight", "bold")
				.text(element.Company);

			label
				.append("tspan")
				.attr("class", "Console")
				.attr("x", -10)
				.attr("dy", "1.2em")
				.style("font-style", "italic")
				.text(element.Console);

			label
				.append("tspan")
				.attr("class", "Sales")
				.attr("x", -10)
				.attr("dy", "1.2em")
				.text(element.Sales);
		});
}
