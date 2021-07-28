
const $ = _ => document.querySelector(_)
const $c = _ => document.createElement(_)

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
let ntiles = 30;
let scale = 0.5;
let map = generateMap();

let borders;

let isMouseDown = false;
let offsetX = 0;
let offsetY = 0;

let currentOffsetX = 0;
let currentOffsetY = 0;

let div;

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
	tool = [0, 0]
	canvas = $("#bg")

	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;

	borders = {
		left: -canvas.width / 2 - tileWidth,
		right: canvas.width / 2 + tileWidth,
		top: 0 - tileHeight * 3,
		bottom: canvas.height + tileHeight * 3
	}

	w = canvas.width;
	h = canvas.height;
	texWidth = 12
	texHeight = 6
	bg = canvas.getContext("2d")

	bg.translate(w / 2, tileHeight * 1)

	loadHashState(document.location.hash.substring(1))

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
	
	

	// fg.addEventListener('pointerup', click)
	// tools = $('#tools')
	// let toolCount = 0
	// for (let i = 0; i < texHeight; i++) {
	// 	for (let j = 0; j < texWidth; j++) {
	// 		const div = $c('div');
	// 		div.id = `tool_${toolCount++}`
	// 		div.style.display = "block"
	// 		/* width of 132 instead of 130  = 130 image + 2 border = 132 */
	// 		div.style.backgroundPosition = `-${j * 130 + 2}px -${i * 230}px`
	// 		div.addEventListener('click', e => {
	// 			tool = [i, j]
	// 			if (activeTool)
	// 				$(`#${activeTool}`).classList.remove('selected')
	// 			activeTool = e.target.id
	// 			$(`#${activeTool}`).classList.add('selected')
	// 		})
	// 		tools.appendChild(div)
	// 	}
	// }

}

// From https://stackoverflow.com/a/36046727
const ToBase64 = u8 => {
	return btoa(String.fromCharCode.apply(null, u8))
}

const FromBase64 = str => {
	return atob(str).split('').map(c => c.charCodeAt(0))
}

const updateHashState = () => {
	let c = 0
	const u8 = new Uint8Array(ntiles * ntiles)
	for (let i = 0; i < ntiles; i++) {
		for (let j = 0; j < ntiles; j++) {
			u8[c++] = map[i][j][0] * texWidth + map[i][j][1]
		}
	}
	const state = ToBase64(u8)
	history.replaceState(undefined, undefined, `#${state}`)
}

const loadHashState = state => {
	// const u8 = FromBase64(state)
	// let c = 0
	// for (let i = 0; i < ntiles; i++) {
	// 	for (let j = 0; j < ntiles; j++) {
	// 		const t = u8[c++] || 0
	// 		const x = Math.trunc(t / texWidth)
	// 		const y = Math.trunc(t % texWidth)
	// 		map[i][j] = [x, y]
	// 	}
	// }
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

const click = e => {
	isMouseDown = true;

	var touches = e.changedTouches;
	if (touches) {
		console.log(touches);
		currentOffsetX = touches[0].pageX - offsetX;
		currentOffsetY = touches[0].pageY - offsetY;
	} else {
		currentOffsetX = e.offsetX - offsetX;
		currentOffsetY = e.offsetY - offsetY;
	}
	// const pos = getPosition(e)
	// if (pos.x >= 0 && pos.x < ntiles && pos.y >= 0 && pos.y < ntiles) {

	// 	map[pos.x][pos.y][0] = (e.which === 3) ? 0 : tool[0]
	// 	map[pos.x][pos.y][1] = (e.which === 3) ? 0 : tool[1]
	// 	isPlacing = true

	// 	drawMap()
	// 	cf.clearRect(-w, -h, w * 2, h * 2)
	// }
	// updateHashState();
}

const unclick = () => {
	isMouseDown = false;
	// if (isPlacing)
	// 	isPlacing = false
}

const drawMap = () => {
	bg.save();
	bg.setTransform(1, 0, 0, 1, 0, 0);
	bg.clearRect(0, 0, canvas.width, canvas.height)
	bg.restore();

	for (let i = 0; i < ntiles; i++) {
		for (let j = 0; j < ntiles; j++) {
			let tileX = map[i][j][0];
			let tileY = map[i][j][1];
			drawImageTile(bg, i, j, tileX, tileY)
		}
	}
}

const drawTile = (c, x, y, color) => {
	c.save()
	c.translate((y - x) * tileWidth / 2, (x + y) * tileHeight / 2)
	c.beginPath()
	c.moveTo(0, 0)
	c.lineTo(tileWidth / 2, tileHeight / 2)
	c.lineTo(0, tileHeight)
	c.lineTo(-tileWidth / 2, tileHeight / 2)
	c.closePath()
	c.fillStyle = color
	c.fill()
	c.restore()
}

const drawImageTile = (c, x, y, i, j) => {
	let tx = ((y - x) * tileWidth / 2) * scale + offsetX;
	let ty = ((x + y) * tileHeight / 2) * scale + offsetY;

	if (tx < borders.left ||
		tx > borders.right ||
		ty < borders.top ||
		ty > borders.bottom
	) {
		return;
	}
	c.save()
	c.translate(tx, ty)
	j *= 130
	i *= 230
	c.drawImage(texture, j, i, 130, 230, -65, -130, 130 * scale, 230 * scale)
	c.restore()
}

const getPosition = e => {
	const _y = (e.offsetY - tileHeight * 2) / tileHeight,
		_x = e.offsetX / tileWidth - ntiles / 2
	x = Math.floor(_y - _x)
	y = Math.floor(_x + _y)
	return { x, y }
}

const onMove = (e) => {
	e.preventDefault();

	if (isMouseDown) {
		let touches = e.changedTouches;
		if (touches) {
			offsetX = touches[0].pageX - currentOffsetX;
			offsetY = touches[0].pageY - currentOffsetY;
		} else {
			offsetX = e.offsetX - currentOffsetX;
			offsetY = e.offsetY - currentOffsetY;
		}

		// Enforce scroll bounds		
		if (scale * (ntiles * tileWidth / 2 + tileWidth) - canvas.width / 2 < offsetX) {
			offsetX = scale * (ntiles * tileWidth / 2 + tileWidth) - canvas.width / 2;
		}
		if (scale * (ntiles * tileWidth / 2 + tileWidth) - canvas.width / 2 < -offsetX) {
			offsetX = -1 * scale * (ntiles * tileWidth / 2 + tileWidth) + canvas.width / 2;
		}

		if (offsetY > tileHeight) offsetY = tileHeight;
		if (scale * (ntiles * tileHeight + tileHeight * 2) - canvas.height < -offsetY) {
			offsetY = -1 * scale * (ntiles * tileHeight + tileHeight * 2) + canvas.height;
		}
		drawMap()

		$('#banner_container').style.top = `${offsetY}px`
		$('#banner_container').style.left = `${offsetX}px`
	}

	// if (isPlacing)
	// 	click(e)
	// const pos = getPosition(e)
	// cf.clearRect(-w, -h, w * 2, h * 2)
	// if (pos.x >= 0 && pos.x < ntiles && pos.y >= 0 && pos.y < ntiles)
	// 	drawTile(cf, pos.x, pos.y, 'rgba(0,0,0,0.2)')
}
