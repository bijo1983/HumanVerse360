import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Database, Server, Globe, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { FormField, Input, Select } from '../../components/ui/Form';
import { Badge } from '../../components/ui/Badge';

export default function DatabaseSettings() {
  const [tab, setTab] = useState('current');
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-secondary-900">Database Connection</h2>
        <p className="text-sm text-secondary-500">Manage your database connection – Supabase (default) or MariaDB on DigitalOcean</p>
      </div>
      <div className="flex gap-1 border-b border-secondary-200">
        {[['current', 'Current Connection'], ['mariadb', 'Connect MariaDB'], ['status', 'Connection Status']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === key ? 'border-primary-600 text-primary-600' : 'border-transparent text-secondary-500 hover:text-secondary-700'}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'current' && <CurrentDBInfo />}
      {tab === 'mariadb' && <MariaDBConfig />}
      {tab === 'status' && <ConnectionStatus />}
    </div>
  );
}

function CurrentDBInfo() {
  return (
    <div className="space-y-4">
      <div className="card p-5 border-l-4 border-l-accent-500">
        <div className="flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-accent-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-secondary-900">Supabase PostgreSQL (Active)</p>
            <p className="text-sm text-secondary-500 mt-0.5">Your application is connected to a Supabase-hosted PostgreSQL instance with Row Level Security enabled.</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          {[
            ['Type', 'PostgreSQL 15'],
            ['Host', 'Supabase Cloud'],
            ['Region', 'Middle East / Global CDN'],
            ['Security', 'RLS Enabled'],
            ['Backups', 'Automatic Daily'],
            ['Status', 'Connected'],
          ].map(([k, v]) => (
            <div key={k} className="bg-secondary-50 p-3 rounded-lg">
              <p className="text-xs text-secondary-400">{k}</p>
              <p className="text-sm font-semibold text-secondary-800">{v}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-700">
          <p className="font-semibold">Switching to MariaDB</p>
          <p className="mt-1">To connect to a MariaDB instance hosted on DigitalOcean, an API migration layer (edge function or backend proxy) is required since browsers cannot connect directly to MySQL/MariaDB. See the MariaDB tab for configuration instructions.</p>
        </div>
      </div>
    </div>
  );
}

function MariaDBConfig() {
  const [config, setConfig] = useState({
    host: '', port: '3306', database: 'humanverse360', username: '', password: '', ssl: 'true',
  });
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    localStorage.setItem('hv360_mariadb_config', JSON.stringify({ ...config, password: '***HIDDEN***' }));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-4">
      <div className="p-4 bg-warning-50 border border-warning-200 rounded-xl flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-warning-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-warning-700">
          <p className="font-semibold">MariaDB on DigitalOcean – Architecture Note</p>
          <p className="mt-1">Direct browser-to-database connections are not possible due to browser security policies. To use MariaDB, you need a Supabase Edge Function or Node.js API acting as a proxy. The configuration below stores your connection details for use with a backend proxy.</p>
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <h3 className="font-semibold text-secondary-800 flex items-center gap-2"><Database className="w-4 h-4" /> MariaDB Connection Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Host / IP Address">
            <Input value={config.host} onChange={e => setConfig(p => ({...p, host: e.target.value}))}
              placeholder="db-mysql-xxx.digitalocean.com or IP" />
          </FormField>
          <FormField label="Port">
            <Input value={config.port} onChange={e => setConfig(p => ({...p, port: e.target.value}))} placeholder="3306" />
          </FormField>
          <FormField label="Database Name">
            <Input value={config.database} onChange={e => setConfig(p => ({...p, database: e.target.value}))} placeholder="humanverse360" />
          </FormField>
          <FormField label="Username">
            <Input value={config.username} onChange={e => setConfig(p => ({...p, username: e.target.value}))} placeholder="doadmin" />
          </FormField>
          <FormField label="Password">
            <Input type="password" value={config.password} onChange={e => setConfig(p => ({...p, password: e.target.value}))} placeholder="••••••••" />
          </FormField>
          <FormField label="SSL Mode">
            <Select value={config.ssl} onChange={e => setConfig(p => ({...p, ssl: e.target.value}))}>
              <option value="true">Required (Recommended)</option>
              <option value="false">Disabled</option>
            </Select>
          </FormField>
        </div>

        <div className="p-3 bg-secondary-50 rounded-lg">
          <p className="text-xs font-semibold text-secondary-600 mb-2">Connection String Preview</p>
          <code className="text-xs font-mono text-secondary-700 break-all">
            mysql://{config.username || 'user'}:***@{config.host || 'host'}:{config.port}/{config.database}?ssl={config.ssl}
          </code>
        </div>

        <button onClick={handleSave} className={`btn-primary ${saved ? 'bg-success-600' : ''}`}>
          {saved ? <><CheckCircle className="w-4 h-4" /> Saved!</> : <><Server className="w-4 h-4" /> Save Configuration</>}
        </button>
      </div>

      <div className="card p-5">
        <h3 className="font-semibold text-secondary-800 mb-3">DigitalOcean Setup Guide</h3>
        <ol className="space-y-2 text-sm text-secondary-600">
          {[
            'Create a managed MySQL/MariaDB database cluster in DigitalOcean',
            'Add your app server IP to the database firewall trusted sources',
            'Create a database named "humanverse360" and a dedicated user',
            'Enable SSL connections (CA certificate available in DigitalOcean dashboard)',
            'Deploy the Humanverse360 API proxy (Node.js/Express with mysql2 package)',
            'Update the VITE_API_URL environment variable to point to your proxy',
            'Run the schema migration SQL in your MariaDB instance',
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
              {step}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function ConnectionStatus() {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);

  const testConnection = async () => {
    setTesting(true);
    setResult(null);
    try {
      const start = Date.now();
      const { data, error } = await supabase.from('departments').select('count').limit(1);
      const elapsed = Date.now() - start;
      if (error) throw error;
      setResult({ success: true, latency: elapsed });
    } catch (e) {
      setResult({ success: false, error: e.message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h3 className="font-semibold text-secondary-800 mb-4">Database Health Check</h3>
        <button onClick={testConnection} disabled={testing} className="btn-primary mb-4">
          {testing ? 'Testing...' : 'Test Connection'}
        </button>
        {result && (
          <div className={`p-4 rounded-xl border ${result.success ? 'bg-success-50 border-success-200' : 'bg-error-50 border-error-200'}`}>
            <div className="flex items-center gap-2">
              {result.success
                ? <CheckCircle className="w-5 h-5 text-success-600" />
                : <AlertTriangle className="w-5 h-5 text-error-600" />}
              <p className={`font-semibold text-sm ${result.success ? 'text-success-700' : 'text-error-700'}`}>
                {result.success ? `Connected successfully (${result.latency}ms)` : `Connection failed`}
              </p>
            </div>
            {result.error && <p className="text-xs text-error-600 mt-1">{result.error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
