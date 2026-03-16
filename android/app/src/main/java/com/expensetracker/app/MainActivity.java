package com.expensetracker.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.google.firebase.FirebaseApp;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Firebase'i Native(Kamera/OCR) seviyesinde başlat
        FirebaseApp.initializeApp(this);
    }
}
