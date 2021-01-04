import * as THREE from './three.module.js';
import { OrbitControls } from './OrbitControls.js';

const width = window.innerWidth;
const height = window.innerHeight;
const rendererBg = new THREE.Color('#5d5d5d');
const clothColor = '#ffaaa5';
const clock = new THREE.Clock();
const loader = new THREE.TextureLoader();

const CLOTH_SIZE = 10;
const CLOTH_SEGMENTS = 10;
const VERTS_COUNT = CLOTH_SEGMENTS + 1;
const VERT_LENGTH = CLOTH_SIZE / CLOTH_SEGMENTS;
const VERT_DIAGONAL_LENGTH = Math.sqrt((VERT_LENGTH * VERT_LENGTH) * 2);
const CLOTH_K = 1;
const GRAVITY = 1;
const TIME_SCALE = 10;
const WIND_SPEED_MIN_X = 1;
const WIND_SPEED_MAX_X = 3;
const WIND_SPEED_MIN_Y = 0;
const WIND_SPEED_MAX_Y = 1;
const WIND_SPEED_MIN_Z = 2;
const WIND_SPEED_MAX_Z = 4; 

let renderer;
let scene;
let camera;
let mesh;
let geometry;
let vertexVelocities = [];

// changing wind force
let WIND_FORCE_X = 0;
let WIND_FORCE_Y = 0;
let WIND_FORCE_Z = 1.5;

// mouse click
let clickChecker = false;
let mouseIsPressed = false;

// fix for delta time variables
let deltaTime = 0;
let typicalFrame  = 16;
let smallestFrame = 14;
let longestFrame  = 50;
let timeBefore = Date.now();

init()

function init() {
    document.body.style.margin = '0';
    createScene();
    createAxesHelper();
    createCamera();
    createControls();
    createFloor();
    createCloth();
    createSpotlight();
    createAmbientLight();
    loop();

    window.addEventListener('resize', onResize);
    document.addEventListener('click', onMousePress);
}


function onResize() {
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
}

function onMousePress(){
    
    let randFloat_X = Math.random() * (WIND_SPEED_MAX_X - WIND_SPEED_MIN_X) + WIND_SPEED_MIN_X;
    let randFloat_Y = Math.random() * (WIND_SPEED_MAX_Y - WIND_SPEED_MIN_Y) + WIND_SPEED_MIN_Y;
    let randFloat_Z = Math.random() * (WIND_SPEED_MAX_Z - WIND_SPEED_MIN_Z) + WIND_SPEED_MIN_Z;

    if(!clickChecker){
        mouseIsPressed = true;
        clickChecker = true;
        WIND_FORCE_X = randFloat_X;
        WIND_FORCE_Y = randFloat_Y;
        WIND_FORCE_Z = randFloat_Z;
    }

    else if(clickChecker){
        mouseIsPressed = false;     
        clickChecker = false;
        WIND_FORCE_X = randFloat_X;
        WIND_FORCE_Y = randFloat_Y;
        WIND_FORCE_Z = randFloat_Z;
    }
}

function createScene() {
    scene = new THREE.Scene();
    renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true
    });

    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(rendererBg);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    document.body.appendChild(renderer.domElement);
}

function createAxesHelper() {
    const axesHelper = new THREE.AxesHelper(1);
    scene.add(axesHelper);
}

function createCamera() {
    camera = new THREE.PerspectiveCamera(45, width / height, 1, 1000);
    camera.position.set(0, 0, 20);
}

function createControls() {
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.maxPolarAngle = Math.PI;
    controls.minDistance = 10;
    controls.maxDistance = 30;
}

function createFloor() {
    const groundTexture = loader.load("textures/prototyping_texture.png");
    groundTexture.wrapS = groundTexture.wrapT = THREE.RepeatWrapping;
    groundTexture.repeat.set(1000, 1000);
    groundTexture.anisotropy = 16;
    groundTexture.encoding = THREE.sRGBEncoding;

    const floorGeometry = new THREE.PlaneBufferGeometry(10000, 10000);
    const floorMaterial = new THREE.MeshLambertMaterial({ map: groundTexture });
    const mesh = new THREE.Mesh(floorGeometry, floorMaterial);
    mesh.position.y = -20;
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    scene.add(mesh);
}

function createCloth() {
    geometry = new THREE.PlaneGeometry(CLOTH_SIZE, CLOTH_SIZE, CLOTH_SEGMENTS, CLOTH_SEGMENTS);
    const material = new THREE.MeshPhysicalMaterial({
        color: clothColor,
        metalness: 0.2,
        emissive: 0x333333,
        side: THREE.DoubleSide,
        wireframe: true
    });
    mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    mesh.position.set(0, 0, 0);
    scene.add(mesh);

    for (let i = 0; i < geometry.vertices.length; i++) {
        const pos = geometry.vertices[i];

        // Keep track of velocity
        vertexVelocities.push(new THREE.Vector3());
    }
}

function createSpotlight() {
    const light = new THREE.SpotLight(0xffffff, 0.9);
    light.position.set(0, 10, 10);
    scene.add(light);
}

function createAmbientLight() {
    const light = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(light);
}

function loop() {
    requestAnimationFrame(loop);
    update();
    render();
}

function update() {
    //let deltaTime = clock.getDelta() * TIME_SCALE;

    // fix for delta time variables
    let timeNow = Date.now();
    let fixedDeltaTime = timeNow - timeBefore;
    
    if (fixedDeltaTime<smallestFrame) {
        return;
    }

    if (fixedDeltaTime>longestFrame){
        fixedDeltaTime = typicalFrame;
    }

    timeBefore = timeNow;

    updateCloth(fixedDeltaTime/100);
    updateCamera();
}

function updateCloth(deltaTime) {
    for (let i = 0; i < geometry.vertices.length; i++) {
        const pos = geometry.vertices[i];
        const vel = vertexVelocities[i];

        // Get vertex coordinates relative to top left corner
        const x = i % VERTS_COUNT;
        const y = Math.floor(i / VERTS_COUNT);

        // Check for adjacent vertices
        const hasLeft = x > 0;
        const hasRight = x < VERTS_COUNT - 1;
        const hasUp = y > 0;
        const hasDown = y < VERTS_COUNT - 1;

        // Left
        if (hasLeft) {
            const otherPos = geometry.vertices[i - 1];
            addOtherVertexForce(otherPos, pos, vel, VERT_LENGTH);
        }

        // Right
        if (hasRight) {
            const otherPos = geometry.vertices[i + 1];
            addOtherVertexForce(otherPos, pos, vel, VERT_LENGTH);
        }

        // Up
        if (hasUp) {
            const otherPos = geometry.vertices[i - VERTS_COUNT];
            addOtherVertexForce(otherPos, pos, vel, VERT_LENGTH);
        }

        // Down
        if (hasDown) {
            const otherPos = geometry.vertices[i + VERTS_COUNT];
            addOtherVertexForce(otherPos, pos, vel, VERT_LENGTH);
        }

        // Upper left
        if (hasUp && hasLeft) {
            const otherPos = geometry.vertices[i - VERTS_COUNT - 1];
            addOtherVertexForce(otherPos, pos, vel, VERT_DIAGONAL_LENGTH);
        }

        // Upper right
        if (hasUp && hasRight) {
            const otherPos = geometry.vertices[i - VERTS_COUNT + 1];
            addOtherVertexForce(otherPos, pos, vel, VERT_DIAGONAL_LENGTH);
        }

        // Down left
        if (hasDown && hasLeft) {
            const otherPos = geometry.vertices[i + VERTS_COUNT - 1];
            addOtherVertexForce(otherPos, pos, vel, VERT_DIAGONAL_LENGTH);
        }

        // Down right
        if (hasDown && hasRight) {
            const otherPos = geometry.vertices[i + VERTS_COUNT + 1];
            addOtherVertexForce(otherPos, pos, vel, VERT_DIAGONAL_LENGTH);
        }

        // Gravity
        vel.y -= GRAVITY * deltaTime

        // Wind Force
        if(mouseIsPressed){
            vel.x += WIND_FORCE_X * deltaTime
            vel.y += WIND_FORCE_Y * deltaTime
            vel.z += WIND_FORCE_Z * deltaTime  
            //console.log(WIND_FORCE);
        }

        else if(!mouseIsPressed){
            vel.x -= WIND_FORCE_X * deltaTime
            vel.y -= WIND_FORCE_Y * deltaTime
            vel.z -= WIND_FORCE_Z * deltaTime
            //console.log(WIND_FORCE);
        }
        

        // Top are fixed
        if (i <= 10) {
            vel.x = 0;
            vel.y = 0;
            vel.z = 0;
        }
    }

    // Apply velocity
    for (let i = 0; i < geometry.vertices.length; i++) {
        const pos = geometry.vertices[i];
        const vel = vertexVelocities[i];

        vel.multiplyScalar(deltaTime);
        pos.add(vel);
    }

    geometry.verticesNeedUpdate = true;
    geometry.computeVertexNormals();

    function addOtherVertexForce(otherPos, pos, vel, vert_length) {
        const force = (pos.distanceTo(otherPos) - vert_length) * CLOTH_K;
        const dir = new THREE.Vector3(otherPos.x - pos.x, otherPos.y - pos.y, otherPos.z - pos.z).normalize();
        const accel = new THREE.Vector3(dir.x, dir.y, dir.z).multiplyScalar(force);
        vel.add(accel);
    }
}

function updateCamera() {
    camera.updateProjectionMatrix();
}

function render() {
    renderer.render(scene, camera);
}
