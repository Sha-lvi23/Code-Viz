import React, { useState, useCallback } from 'react';
import ReactFlow, {
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import './App.css';


const InsightPanel = ({ node, onClose }) => {
  if (!node) {
    return null;
  }

  const { data } = node;
  const { label, dependencies = [], dependents = [] } = data;

  return (
    <aside className="insight-panel">
      <button onClick={onClose} className="close-button">×</button>
      <h3>{label}</h3>
      <div className="panel-section">
        <h4>Dependencies ({dependencies.length})</h4>
        <p>This file imports the following files:</p>
        <ul>
          {dependencies.length > 0 ? (
            dependencies.map((dep, i) => <li key={i}>{dep}</li>)
          ) : (
            <li>None</li>
          )}
        </ul>
      </div>
      <div className="panel-section">
        <h4>Dependents ({dependents.length})</h4>
        <p>This file is imported by the following files:</p>
        <ul>
          {dependents.length > 0 ? (
            dependents.map((dep, i) => <li key={i}>{dep}</li>)
          ) : (
            <li>None</li>
          )}
        </ul>
      </div>
    </aside>
  );
};


function App() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('Upload your project .zip file to begin.');
  const [selectedNode, setSelectedNode] = useState(null); // NEW: State for selected node

  const onNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [setNodes]
  );
  const onEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [setEdges]
  );
  const onConnect = useCallback(
    (conn) => setEdges((eds) => addEdge(conn, eds)),
    [setEdges]
  );

  
  const onNodeClick = (event, node) => {
    setSelectedNode(node);
  };

  const handleFileUpload = async (event) => {
  
    const file = event.target.files[0];
    if (!file) return;

    setIsLoading(true);
    setMessage(`Uploading and analyzing "${file.name}"...`);
    setNodes([]);
    setEdges([]);
    setSelectedNode(null); 

    const formData = new FormData();
    formData.append('projectZip', file);

    try {
      const response = await fetch('http://localhost:5000/api/visualize', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Network response was not ok: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Data received from backend:', data);

      setNodes(data.nodes || []);
      setEdges(data.edges || []);
      setMessage(data.message || 'Analysis complete! Click a node for details.');

    } catch (error) {
      console.error('Error uploading file:', error);
      setMessage('An error occurred during upload. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-container">
      <div className="main-content">
        <header className="app-header">
          <h1>CodeViz</h1>
          <p>Interactive Codebase Dependency Visualizer</p>
          <div className="controls">
            <input
              type="file"
              id="file-upload"
              accept=".zip"
              onChange={handleFileUpload}
              disabled={isLoading}
              style={{ display: 'none' }}
            />
            <label htmlFor="file-upload" className={`button ${isLoading ? 'disabled' : ''}`}>
              {isLoading ? 'Analyzing...' : 'Upload .zip'}
            </label>
          </div>
          <p className="status-message">{message}</p>
        </header>
        <main className="graph-container">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick} 
            fitView
          >
            <Controls />
            <Background variant="dots" gap={12} size={1} />
          </ReactFlow>
        </main>
      </div>
      <InsightPanel node={selectedNode} onClose={() => setSelectedNode(null)} />
    </div>
  );
}

export default App;