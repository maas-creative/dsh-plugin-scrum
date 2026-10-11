// Dimension policy for providers which require a maximum 1568 pixel edge.
export function calculateTargetDimensions(width,height){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return null;
 const edge=Math.max(width,height);if(edge<=1568)return null;
 const scale=1568/edge;
 return {width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))};
}
