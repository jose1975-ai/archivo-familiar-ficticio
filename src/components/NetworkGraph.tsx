import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { FamilyMember, Connection } from '../types';

interface Node extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  group: number;
}

interface Link extends d3.SimulationLinkDatum<Node> {
  source: string | Node;
  target: string | Node;
}

interface NetworkGraphProps {
  families: Record<string, FamilyMember>;
  connections: Connection[];
  onNodeClick?: (id: string) => void;
}

export const NetworkGraph: React.FC<NetworkGraphProps> = ({ families, connections, onNodeClick }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const width = 800;
    const height = 600;

    const svg = d3.select(svgRef.current)
      .attr('viewBox', [0, 0, width, height])
      .attr('style', 'max-width: 100%; height: auto;');

    svg.selectAll('*').remove();

    // Add a subtle paper texture pattern
    const defs = svg.append('defs');
    
    // Prepare data from props
    const nodes: Node[] = (Object.values(families) as FamilyMember[]).map((f, i) => ({
      id: f.id,
      name: f.name,
      group: i % 5 + 1
    }));

    const links: Link[] = connections.map(c => ({
      source: c.source,
      target: c.target
    })).filter(l => 
      nodes.find(n => n.id === l.source) && 
      nodes.find(n => n.id === l.target)
    );

    const simulation = d3.forceSimulation<Node>(nodes)
      .force('link', d3.forceLink<Node, Link>(links).id(d => d.id).distance(180))
      .force('charge', d3.forceManyBody().strength(-500))
      .force('center', d3.forceCenter(width / 2, height / 2));

    // Add arrow marker definition
    defs.append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 22) // Adjusted for circle radius
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('xoverflow', 'visible')
      .append('svg:path')
      .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
      .attr('fill', '#2c2c2c')
      .style('stroke', 'none');

    const link = svg.append('g')
      .selectAll('g')
      .data(links)
      .join('g')
      .attr('class', 'link-group')
      .on('mouseover', function() {
        d3.select(this).select('line').attr('stroke-opacity', 1).attr('stroke-width', 2);
        d3.select(this).select('rect').attr('opacity', 1);
      })
      .on('mouseout', function() {
        d3.select(this).select('line').attr('stroke-opacity', 0.4).attr('stroke-width', 1);
        d3.select(this).select('rect').attr('opacity', 0.8);
      });

    link.append('line')
      .attr('stroke', '#2c2c2c')
      .attr('stroke-opacity', 0.4)
      .attr('stroke-dasharray', '5,5')
      .attr('stroke-width', 1)
      .attr('marker-end', 'url(#arrowhead)');

    link.append('rect')
      .attr('fill', '#f4f1ea')
      .attr('opacity', 0.8)
      .attr('rx', 2)
      .attr('ry', 2)
      .attr('stroke', '#2c2c2c')
      .attr('stroke-width', 0.5);

    link.append('text')
      .attr('font-family', 'Special Elite')
      .attr('font-size', '10px')
      .attr('fill', '#2c2c2c')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .text((d: any) => {
        const conn = connections.find(c => 
          (c.source === (d.source.id || d.source) && c.target === (d.target.id || d.target)) ||
          (c.target === (d.source.id || d.source) && c.source === (d.target.id || d.target))
        );
        return conn?.label || '';
      });

    const node = svg.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .attr('class', 'node-group')
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        if (onNodeClick) onNodeClick(d.id);
      })
      .call(d3.drag<SVGGElement, Node>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended) as any);

    node.append('circle')
      .attr('r', 10)
      .attr('fill', '#f4f1ea')
      .attr('stroke', '#2c2c2c')
      .attr('stroke-width', 2)
      .style('filter', 'drop-shadow(2px 2px 2px rgba(0,0,0,0.1))');

    node.append('text')
      .attr('x', 15)
      .attr('y', 4)
      .text(d => d.name)
      .attr('font-family', 'Special Elite')
      .attr('font-size', '14px')
      .attr('font-weight', 'bold')
      .attr('fill', '#2c2c2c');

    simulation.on('tick', () => {
      try {
        link.select('line')
          .attr('x1', d => (d.source as Node).x!)
          .attr('y1', d => (d.source as Node).y!)
          .attr('x2', d => (d.target as Node).x!)
          .attr('y2', d => (d.target as Node).y!);

        link.select('text')
          .attr('x', d => ((d.source as Node).x! + (d.target as Node).x!) / 2)
          .attr('y', d => ((d.source as Node).y! + (d.target as Node).y!) / 2);

        link.select('rect')
          .attr('x', function(d: any) {
            const text = d3.select((this as any).parentNode).select('text').node() as SVGTextElement;
            if (!text) return 0;
            const bbox = text.getBBox();
            return ((d.source as Node).x! + (d.target as Node).x!) / 2 - bbox.width / 2 - 2;
          })
          .attr('y', function(d: any) {
            const text = d3.select((this as any).parentNode).select('text').node() as SVGTextElement;
            if (!text) return 0;
            const bbox = text.getBBox();
            return ((d.source as Node).y! + (d.target as Node).y!) / 2 - bbox.height / 2;
          })
          .attr('width', function() {
            const text = d3.select((this as any).parentNode).select('text').node() as SVGTextElement;
            if (!text) return 0;
            return text.getBBox().width + 4;
          })
          .attr('height', function() {
            const text = d3.select((this as any).parentNode).select('text').node() as SVGTextElement;
            if (!text) return 0;
            return text.getBBox().height;
          });

        node
          .attr('transform', d => `translate(${d.x},${d.y})`);
      } catch (e) {
        // Simulation might still be running during unmount or when elements are hidden
        console.warn("D3 simulation tick error:", e);
      }
    });

    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    return () => simulation.stop();
  }, [families, connections]);

  return (
    <div 
      className="w-full h-[600px] border border-vintage-ink/20 bg-vintage-paper rounded-lg overflow-hidden cursor-crosshair relative"
      style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/paper-fibers.png")' }}
    >
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
};
