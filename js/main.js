
const $ = _ => document.querySelector(_)
const $c = _ => document.createElement(_)
let ntiles = 50;

const generateMap = () => {
	const map = [];
	for (let i = 0; i < ntiles; i++) {
		map[i] = [];
		for (let j = 0; j < ntiles; j++) {
			let tileX = Math.ceil(Math.random() * 6) - 1;
			let tileY = Math.ceil(Math.random() * 11) - 1;
			map[i][j] = [tileX, tileY];
		}
	}
	console.log(JSON.stringify(map))
	return map;
}

let canvas, bg, fg, cf, tools, tool, activeTool, isPlacing

let tileWidth = 128;
let tileHeight = 64;

let scale = 0.5;
let map = generateMap();

let borders;

let isMouseDown = false;
let offsetX = 0;
let offsetY = 0;

let currentOffsetX = 0;
let currentOffsetY = 0;

let lastPositionX = 0;
let lastPositionY = 0;

let div;

let isPinching = false;
let startTouchDifference = 0;
let zoomPointX;
let zoomPointY;

const brands = [
	{
		name: "Zign",
		position: { x: 100, y: 100 },
		link: "https://en.zalando.de/all/zign/",
	},
	{
		name: "ARMEDANGELS",
		position: { x: 300, y: 300 },
		link: "https://en.zalando.de/explore/armedangels/",
	}
]

/* texture from https://opengameart.org/content/isometric-landscape */
const texture = new Image()
texture.src = "textures/01_130x66_130x230.png"
texture.onload = _ => init()

const init = () => {
	canvas = $("#bg")

	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;

	borders = {
		left: 0 - tileWidth,
		right: canvas.width + tileWidth,
		top: 0 - tileHeight,
		bottom: canvas.height + tileHeight * 1
	}

	w = canvas.width;
	h = canvas.height;
	texWidth = 12
	texHeight = 6
	bg = canvas.getContext("2d")

	offsetX = w;
	offsetY = -h;

	drawMap()

	fg = $('#fg')
	fg.width = canvas.width
	fg.height = canvas.height

	cf = fg.getContext('2d')
	cf.translate(w / 2, tileHeight * 2)

	fg.addEventListener('contextmenu', e => e.preventDefault())

	fg.addEventListener('mouseup', unclick)

	fg.addEventListener('touchstart', click)
	fg.addEventListener('mousedown', click)

	fg.addEventListener('mousemove', onMove)
	fg.addEventListener('touchmove', onMove);

	for (let i = 0; i < brands.length; i++) {
		let banner = buildBrandBanner(brands[i]);
		$('#banner_container').appendChild(banner)
	}
}

const buildBrandBanner = brand => {
	let div = $c('div');
	div.classList.add('brand')
	div.style.top = `${brand.position.y}px`
	div.style.left = `${brand.position.x}px`

	let a = $c('a');
	a.href = brand.link;
	a.innerHTML = brand.name;

	div.appendChild(a);

	return div;
};

const drawMap = () => {
	bg.save();
	bg.setTransform(1, 0, 0, 1, 0, 0);
	bg.clearRect(0, 0, canvas.width, canvas.height)
	bg.restore();

	let drawCount = 0;
	for (let i = 0; i < ntiles; i++) {
		for (let j = 0; j < ntiles; j++) {
			let tileX = map[i][j][0];
			let tileY = map[i][j][1];

			if (drawImageTile(bg, i, j, tileX, tileY)) {
				drawCount++;
			}
		}
	}

	// $('#log').innerHTML = drawCount

	bg.beginPath();
	bg.arc(zoomPointX, zoomPointY, 10, 0, 2 * Math.PI);
	bg.fillStyle = 'red';
	bg.fill();
	bg.stroke();
};

const drawImageTile = (c, x, y, i, j) => {
	let tx = ((y - x) * tileWidth / 2) + offsetX;
	let ty = ((x + y) * tileHeight / 2) + offsetY;

	if (tx * getScale() < borders.left ||
		tx * getScale() > borders.right ||
		ty * getScale() < borders.top ||
		ty * getScale() > borders.bottom
	) {
		return false;
	}
	c.save()
	c.scale(getScale(), getScale())

	// c.translate(tx, ty)
	// j,i - indicies of the tile on the tilemap
	c.drawImage(
		texture, // atlass
		j * 130, // position on the tilemap
		i * 230, // position on the tilemap
		130,  // source width
		230,  // source height
		tx - 65, // offset on the canvas
		ty - 130, // offset on the canvas
		130, // width on the canvas
		230  // height on the canvas
	)
	c.restore()

	return true;
}

const click = e => {
	var touches = e.touches;

	if (touches) {
		lastPositionX = touches[0].pageX;
		lastPositionY = touches[0].pageY;
	} else {
		lastPositionX = e.offsetX;
		lastPositionY = e.offsetY;
	}

	if (touches && touches.length > 1) {
		// Second touch
		// Start pinch
		isPinching = true;
		startTouchDifference = getTouchDistance(touches);
		getZoomPoint(touches);
		return;
	}
	isMouseDown = true;

	currentOffsetX = offsetX;
	currentOffsetY = offsetY;

}

const unclick = e => {
	var touches = e.touches;
	if (touches && isPinching && touches.length <= 1) {
		// Stop pinch
		isPinching = false;

		// Set whatever remains as last position
		lastPositionX = touches[0].pageX;
		lastPositionY = touches[0].pageY;
	}
	isMouseDown = false;
}

const getScale = () => {
	return scale;
};

const getZoomPoint = touches => {
	const first = touches[0];
	const second = touches[1];

	zoomPointX = (first.pageX + second.pageX) / 2;
	zoomPointY = (first.pageY + second.pageY) / 2;
}

const getTouchDistance = touches => {
	const first = touches[0];
	const second = touches[1];

	const diffX = (second.pageX - first.pageX);
	const diffY = (second.pageY - first.pageY);

	const distance = Math.sqrt(diffX * diffX + diffY * diffY);

	return distance;
}

const onMove = (e) => {
	e.preventDefault();

	if (isMouseDown) {
		const touches = e.touches;
		if (touches && touches.length > 1) {

			const newTouchDifference = getTouchDistance(touches);

			// 200 -> 100
			// 1 -> 0.5
			// 0.5 = 1 * 100 / 200		

			const newScale = scale * newTouchDifference / startTouchDifference;
			if (newScale < 0.2) {
				newScale = 0.2;
			}
			if (newScale > 2.0) {
				newScale = 2.0;
			}

			startTouchDifference = newTouchDifference;

			// 830 with 1 is 830 - offset 0
			// 830 with 1.2 is 691.6 
			offsetX = offsetX + (zoomPointX / newScale - zoomPointX / scale);
			offsetY = offsetY + (zoomPointY / newScale - zoomPointY / scale);

			scale = newScale;

			drawMap();

			// TODO: We can treat the mid-point here as touch point

			return;
		}

		if (touches) {
			offsetX += (touches[0].pageX - lastPositionX) / getScale();
			offsetY += (touches[0].pageY - lastPositionY) / getScale();

			lastPositionX = touches[0].pageX;
			lastPositionY = touches[0].pageY;

		} else {
			offsetX += (e.offsetX - lastPositionX) / getScale();
			offsetY += (e.offsetY - lastPositionY) / getScale();

			lastPositionX = e.offsetX;
			lastPositionY = e.offsetY;
		}


		// Enforce scroll bounds		
		// if (getScale() * (ntiles * tileWidth / 2 + tileWidth) - canvas.width / 2 < offsetX) {
		// 	offsetX = getScale() * (ntiles * tileWidth / 2 + tileWidth) - canvas.width / 2;
		// }
		// if (getScale() * (ntiles * tileWidth / 2 + tileWidth) - canvas.width / 2 < -offsetX) {
		// 	offsetX = -1 * getScale() * (ntiles * tileWidth / 2 + tileWidth) + canvas.width / 2;
		// }

		// if (offsetY > tileHeight) offsetY = tileHeight;
		// if (getScale() * (ntiles * tileHeight + tileHeight * 2) - canvas.height < -offsetY) {
		// 	offsetY = -1 * getScale() * (ntiles * tileHeight + tileHeight * 2) + canvas.height;
		// }
		drawMap()

		$('#banner_container').style.top = `${offsetY}px`
		$('#banner_container').style.left = `${offsetX}px`
	}
}
