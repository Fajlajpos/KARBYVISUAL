const sizeOf = require('image-size');
const dimensions = sizeOf('public/assets/kolaz_v5.jpg');
console.log(dimensions.width, dimensions.height);
