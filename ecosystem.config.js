module.exports = {
  apps: [{
    name: 'phone-manager',
    script: 'server.js',
    max_memory_restart: '300M',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: 'logs/error.log',
    out_file: 'logs/out.log',
    merge_logs: true,
    max_size: '10M',
    retain: 3,
  }]
};
