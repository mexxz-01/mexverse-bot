package com.mexverse.switchapp;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.Vibrator;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {

    private TextView tvStatus, tvRam, tvUptime, tvServerIp;
    private Button btnPower, btnRestart;
    private String serverHost = "172.16.118.138:4444";
    private boolean isBotRunning = false;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private boolean isDestroyed = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        SharedPreferences prefs = getSharedPreferences("bot_prefs", MODE_PRIVATE);
        serverHost = prefs.getString("server_host", "172.16.118.138:4444");

        tvStatus = findViewById(R.id.tvStatus);
        tvRam = findViewById(R.id.tvRam);
        tvUptime = findViewById(R.id.tvUptime);
        tvServerIp = findViewById(R.id.tvServerIp);
        btnPower = findViewById(R.id.btnPower);
        btnRestart = findViewById(R.id.btnRestart);

        updateIpLabel();

        btnPower.setOnClickListener(v -> toggleBot());
        btnRestart.setOnClickListener(v -> restartBot());

        tvServerIp.setOnClickListener(v -> showChangeIpDialog());

        startPolling();
    }

    private void updateIpLabel() {
        tvServerIp.setText("Host IP: " + serverHost + " (Tap to Change)");
    }

    private void showChangeIpDialog() {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("Set PC Host IP");
        final EditText input = new EditText(this);
        input.setText(serverHost);
        builder.setView(input);

        builder.setPositiveButton("Save", (dialog, which) -> {
            String newIp = input.getText().toString().trim();
            if (!newIp.isEmpty()) {
                serverHost = newIp;
                getSharedPreferences("bot_prefs", MODE_PRIVATE).edit().putString("server_host", serverHost).apply();
                updateIpLabel();
                fetchStatus();
            }
        });
        builder.setNegativeButton("Cancel", (dialog, which) -> dialog.cancel());
        builder.show();
    }

    private void vibrate() {
        try {
            Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (v != null) v.vibrate(50);
        } catch (Exception ignored) {}
    }

    private void toggleBot() {
        vibrate();
        btnPower.setEnabled(false);
        tvStatus.setText("SWITCHING...");
        executor.execute(() -> {
            postHttp("http://" + serverHost + "/api/toggle");
            mainHandler.postDelayed(() -> {
                btnPower.setEnabled(true);
                fetchStatus();
            }, 500);
        });
    }

    private void restartBot() {
        vibrate();
        tvStatus.setText("RESTARTING...");
        executor.execute(() -> {
            postHttp("http://" + serverHost + "/api/restart");
            mainHandler.postDelayed(this::fetchStatus, 1500);
        });
    }

    private void startPolling() {
        fetchStatus();
        mainHandler.postDelayed(new Runnable() {
            @Override
            public void run() {
                if (!isDestroyed) {
                    fetchStatus();
                    mainHandler.postDelayed(this, 2000);
                }
            }
        }, 2000);
    }

    private void fetchStatus() {
        executor.execute(() -> {
            String res = getHttp("http://" + serverHost + "/api/status");
            mainHandler.post(() -> {
                if (res != null) {
                    try {
                        JSONObject json = new JSONObject(res);
                        isBotRunning = json.optBoolean("running", false);
                        int ram = json.optInt("memoryMB", 0);
                        int uptime = json.optInt("uptime", 0);

                        tvRam.setText(ram + " MB");

                        int hrs = uptime / 3600;
                        int mins = (uptime % 3600) / 60;
                        int secs = uptime % 60;
                        tvUptime.setText(String.format("%02d:%02d:%02d", hrs, mins, secs));

                        if (isBotRunning) {
                            tvStatus.setText("● BOT ONLINE (TAP TO STOP)");
                            tvStatus.setTextColor(0xFF10B981);
                            btnPower.setBackgroundResource(R.drawable.btn_circle_green);
                            btnPower.setText("⏻\nONLINE");
                        } else {
                            tvStatus.setText("● BOT STOPPED (TAP TO START)");
                            tvStatus.setTextColor(0xFFEF4444);
                            btnPower.setBackgroundResource(R.drawable.btn_circle_red);
                            btnPower.setText("⏻\nOFFLINE");
                        }
                    } catch (Exception e) {
                        tvStatus.setText("DATA ERROR");
                    }
                } else {
                    tvStatus.setText("● PC UNREACHABLE (CHECK WI-FI)");
                    tvStatus.setTextColor(0xFF94A3B8);
                }
            });
        });
    }

    private String getHttp(String urlStr) {
        try {
            URL url = new URL(urlStr);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(2500);
            conn.setReadTimeout(2500);
            if (conn.getResponseCode() == 200) {
                BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) sb.append(line);
                reader.close();
                return sb.toString();
            }
        } catch (Exception ignored) {}
        return null;
    }

    private void postHttp(String urlStr) {
        try {
            URL url = new URL(urlStr);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setConnectTimeout(2500);
            conn.setReadTimeout(2500);
            conn.setDoOutput(true);
            OutputStream os = conn.getOutputStream();
            os.write("{}".getBytes());
            os.flush();
            os.close();
            conn.getResponseCode();
        } catch (Exception ignored) {}
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        isDestroyed = true;
        executor.shutdown();
    }
}
