
const $ = _ => document.querySelector(_)
const $c = _ => document.createElement(_)
const texture = new Image()
const texture2 = new Image()

const generateMap = (seed) => {
	let rng = new RNG(seed);

	const map = [];
	for (let i = 0; i < ntiles; i++) {
		map[i] = [];
		for (let j = 0; j < ntiles; j++) {
			while (true) {
				let tileX = Math.ceil(rng.nextFloat() * 11) - 1;
				let tileY = Math.ceil(rng.nextFloat() * 6) - 1;
				if (tileY === 2) continue
				map[i][j] = [tileY, tileX, texture];
				break;
			}
		}
	}
	return map;
}

const placeHouse = (x, y, treeCount, seed, map) => {	
	// Base green
	for (let i = -Math.floor(plotSize / 2); i < Math.ceil(plotSize / 2); i++) {
		for (let j = -Math.floor(plotSize / 2); j < Math.ceil(plotSize / 2); j++) {
			map[x + i][y + j] = [0, 5, texture2];
		}
	}

	greenSize = plotSize - 2;
	// Base green
	for (let i = -Math.floor(greenSize / 2); i < Math.ceil(greenSize / 2); i++) {
		for (let j = -Math.floor(greenSize / 2); j < Math.ceil(greenSize / 2); j++) {
			map[x + i][y + j] = [0, 1, texture2];
		}
	}

	// Place trees
	let treePositions = [];
	for (let i = -Math.floor(greenSize / 2); i < Math.ceil(greenSize / 2); i++) {
		for (let j = -Math.floor(greenSize / 2); j < Math.ceil(greenSize / 2); j++) {
			if (i === 0 && j === 0) continue;

			treePositions.push([i, j]);
		}
	}

	// Randomise available tree position	
	var rng = new RNG(seed);

	treePositions = treePositions.sort(() => rng.nextFloat() > 0.5 ? 1 : -1);
	for (let t = 0; t < treeCount; t++) {

		const trees = [2, 3, 4].sort(() => rng.nextFloat() > 0.5 ? 1 : -1);
		const [i, j] = treePositions[t];
		map[x + i][y + j] = [0, trees[0], texture2];
	}

	// Place house
	map[x][y] = [0, 0, texture2];
}

let canvas, bg, fg, cf, tools, tool, activeTool, isPlacing

const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
const userName = urlParams.get('user') || "Zitizen";
const invitedBy = urlParams.get('invitedby');

let scale = 0.5;
let map = generateMap(hashCode(userName));

let borders;

let isMouseDown = false;
let offsetX = 0;
let offsetY = 0;

let currentOffsetX = 0;
let currentOffsetY = 0;

let lastPositionX = 0;
let lastPositionY = 0;

let div;
let startTouchDifference = 0;
let startZoomPoint;

let users = [];
let ownId;
let houses = [];
let brands = [];

firebase.initializeApp(firebaseConfig);

/* texture from https://opengameart.org/content/isometric-landscape */
texture.src = "textures/01_130x66_130x230.png"
texture.onload = _ => init()
texture2.src = "textures/2.png"
texture2.onload = _ => init()

let loadedCount = 0;

const init = () => {
	loadedCount++;
	if (loadedCount < 2) return;

	// Pre-place empty house to wait for loading to happen
	placeHouse(ntiles / 2, ntiles / 2, 0, 0, map);

	firebase.database().ref('brands').get().then(snapshot => {
		brands = snapshot.val();
		// brands = [...brands, ...brands, ...brands, ...brands, ...brands]	
		
		let rng = new RNG(hashCode(userName));
		
		const restrictedRangeStart = ntiles / 2 - plotSize - plotSize / 2;
		const restrictedRangeEnd = ntiles / 2 + plotSize + plotSize / 2;

		for (let i = 0; i < brands.length; i++) {
			let x, y;

			do {
				x = rng.nextRange(0, ntiles);
				y = rng.nextRange(0, ntiles);
			} while(
				x > restrictedRangeStart && x < restrictedRangeEnd ||
				y > restrictedRangeStart && y < restrictedRangeEnd 
			)
			console.log(`R: ${restrictedRangeStart} ${restrictedRangeEnd}`)
			console.log(`${x} ${y}`)
			let tx = ((y - x) * tileWidth / 2);
			let ty = ((x + y) * tileHeight / 2);
			
			map[x][y] = [3, 10, texture];

			let banner = buildBrandBanner(brands[i]);
			brands[i].banner = banner;
			brands[i].position = {
				x: tx,				
				y: ty
			}
			$('#banner_container').appendChild(banner)
		}
		drawMap();	
	});

	firebase.database().ref('users').on('value', snapshot => {
		users = snapshot.val() || [];

		users.forEach(user => {
			if (user.name === userName) {
				ownId = user.id;
			};
		})

		if (ownId === undefined) {			
			// Register ourselves
			// Get next id
			let maxId = -1;
			users.forEach(user => {
				if (user.id > maxId) {
					maxId = user.id;
				}
			})
			firebase.database().ref('users/' + (maxId + 1)).set({
				id: maxId + 1,
				house_plot: {
					trees: Math.round(Math.random() * 40)
				},
				name: userName,
				friends: []
			});

			// Return early, we should get an update on the next snapshot
			return;			
		}
		const ownUser = users[ownId];

		if (invitedBy) {
			const userWhoInvitedUs = users.find(user => user.name === invitedBy);
			if (userWhoInvitedUs === undefined) {
				// Not supposed to happen
				// Wrongly generated link, or user was deleted, ignore
			} else {
				// Person who invited us, doesn't have us as friends yet
				// Add ourselves
				if (!(userWhoInvitedUs.friends || []).some(friend => friend.id === ownUser.id)) {
					firebase.database().ref('users/' + (userWhoInvitedUs.id)).set({	
						...userWhoInvitedUs,					
						friends: [...(userWhoInvitedUs.friends || []), { id: ownUser.id }]
					});
				}
				// If we don't have them as a friend yet, update ourselves
				if (!(ownUser.friends || []).some(friend => friend.id === userWhoInvitedUs.id)) {
					firebase.database().ref('users/' + (ownUser.id)).set({
						...ownUser,
						friends: [...(ownUser.friends || []), { id: userWhoInvitedUs.id }]
					});
					if (ownUser.friends == undefined) {
						ownUser.friends = [];
					}
					// Needed, otherwise we get some wonky updates
					ownUser.friends.push({ id: userWhoInvitedUs.id });
				}
			}
		}

		houses = [
			{
				position: {
					x: ntiles / 2,
					y: ntiles / 2
				},
				trees: ownUser.house_plot.trees,
				name: ownUser.name
			}
		];

		let places = [[8, 0], [0, 8], [-8, 0], [0, -8], [8, 8], [-8, -8], [8, -8], [-8, 8]];
		// NB: for newly created users friends might be undefined
		// Because firebase cannot save empty arrays ;_;
		(ownUser.friends || []).forEach((friend, index) => {
			if (index >= places.length) return;

			houses.push({
				position: {
					x: ntiles / 2 + places[index][0],
					y: ntiles / 2 + places[index][1],
				},
				trees: users[friend.id].house_plot.trees,
				name: users[friend.id].name
			})
		})

		houses.forEach(house => {
			placeHouse(house.position.x, house.position.y, house.trees, hashCode(house.name), map);
		});

		drawMap();
	})


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
	offsetY = - (ntiles - 15) * tileHeight / 2;
	
	drawMap()

	fg = $('#fg')
	fg.width = canvas.width
	fg.height = canvas.height

	cf = fg.getContext('2d')
	cf.translate(w / 2, tileHeight * 2)

	fg.addEventListener('contextmenu', e => e.preventDefault())

	fg.addEventListener('touchend', unclick)
	fg.addEventListener('touchcancel', unclick)
	fg.addEventListener('mouseup', unclick)

	fg.addEventListener('touchstart', click)
	fg.addEventListener('mousedown', click)

	fg.addEventListener('mousemove', onMove)
	fg.addEventListener('touchmove', onMove);
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

	bg.save()
	bg.scale(getScale(), getScale())

	let drawCount = 0;
	for (let i = 0; i < ntiles; i++) {
		for (let j = 0; j < ntiles; j++) {
			let tileX = map[i][j][0];
			let tileY = map[i][j][1];
			let atlas = map[i][j][2];

			if (drawImageTile(bg, i, j, tileX, tileY, atlas)) {
				drawCount++;
			}
		}
	}

	// $('#log').innerHTML = drawCount	

	// Draw house names
	houses.forEach(house => {
		bg.font = '36px Helvetica';

		let x = house.position.x;
		let y = house.position.y;
		let tx = ((y - x) * tileWidth / 2) + offsetX;
		let ty = ((x + y) * tileHeight / 2) + offsetY;

		const houseName = `${house.name}  ${house.trees}🌲`;
		const nameWidth = bg.measureText(houseName).width
		bg.fillText(houseName, tx - nameWidth / 2, ty - 50)
	});
	bg.restore();

	for (let i = 0; i < brands.length; i++) {
		let brand = brands[i];

		brand.banner.style.top = `${(brand.position.y + offsetY) * scale}px`
		brand.banner.style.left = `${(brand.position.x + offsetX - canvas.width / 2) * scale}px`
	}
};

const drawPoint = point => {
	bg.beginPath();
	bg.arc(point.x, point.y, 10, 0, 2 * Math.PI);
	bg.fillStyle = 'red';
	bg.fill();
	bg.stroke();
}

const drawImageTile = (c, x, y, i, j, atlas) => {
	let tx = ((y - x) * tileWidth / 2) + offsetX;
	let ty = ((x + y) * tileHeight / 2) + offsetY;

	if (tx * getScale() < borders.left ||
		tx * getScale() > borders.right ||
		ty * getScale() < borders.top ||
		ty * getScale() > borders.bottom
	) {
		return false;
	}
	// c.translate(tx, ty)
	// j,i - indicies of the tile on the tilemap
	c.drawImage(
		atlas, // atlass
		j * 130, // position on the tilemap
		i * 230, // position on the tilemap
		130,  // source width
		230,  // source height
		tx - 65, // offset on the canvas
		ty - 130, // offset on the canvas
		130, // width on the canvas
		230  // height on the canvas
	)

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

		startTouchDifference = getTouchDistance(touches);
		startZoomPoint = getZoomPoint(touches);

		// Set zoom point as last position to 
		lastPositionX = startZoomPoint.x;
		lastPositionY = startZoomPoint.y;
		return;
	}
	isMouseDown = true;
}

const unclick = e => {
	var touches = e.touches;
	if (touches) {
		if (touches.length > 0) {
			$('#log').innerHTML = "unclick"
			lastPositionX = touches[0].pageX;
			lastPositionY = touches[0].pageY;
			// Still have touch
			return;
		}
	}
	isMouseDown = false;
}

const getScale = () => {
	return scale;
};

const getZoomPoint = touches => {
	const first = touches[0];
	const second = touches[1];

	const zoomPointX = (first.pageX + second.pageX) / 2;
	const zoomPointY = (first.pageY + second.pageY) / 2;

	return {
		x: zoomPointX,
		y: zoomPointY
	}
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

			const zoomPoint = getZoomPoint(touches);
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
			offsetX = offsetX + (zoomPoint.x / newScale - zoomPoint.x / scale);
			offsetY = offsetY + (zoomPoint.y / newScale - zoomPoint.y / scale);

			scale = newScale;

			drawMap();

			// drawPoint(zoomPoint);

			offsetX += (zoomPoint.x - lastPositionX) / getScale();
			offsetY += (zoomPoint.y - lastPositionY) / getScale();

			lastPositionX = zoomPoint.x;
			lastPositionY = zoomPoint.y;

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
	}
}
