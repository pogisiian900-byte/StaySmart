import React from "react";
import SlideshowWheel from "./sildeshowWheel";

const Home = ({ roomData, loading }) => {
  return (
    <div style={{ padding: "20px" }}>
      {loading ? (
        <p style={{ textAlign: "center", fontSize: "18px" }}>
          Loading listings...
        </p>
      ) : roomData && roomData.length > 0 ? (
        <SlideshowWheel data={roomData} useCase={"Stay around your area:"} />
      ) : (
        <p style={{ textAlign: "center" }}>No room listings found.</p>
      )}
    </div>
  );
};

export default Home;
