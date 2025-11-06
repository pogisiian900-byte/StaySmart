import React, { forwardRef, useImperativeHandle, useRef, useEffect } from "react";
import "./PleaseLoginASGuest.css"; // reuse your existing dialog styles

const ListingDetailDialog = forwardRef(({ title, content, icon }, ref) => {
  const modalRef = useRef(null);

  // expose open() and close() to parent via ref
  useImperativeHandle(ref, () => ({
    open: () => modalRef.current?.showModal(),
    close: () => modalRef.current?.close(),
  }));

  // close dialog when clicking outside
  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;

    const handleClickOutside = (e) => {
      const rect = modal.getBoundingClientRect();
      const isInside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;

      if (!isInside) modal.close();
    };

    modal.addEventListener("click", handleClickOutside);
    return () => modal.removeEventListener("click", handleClickOutside);
  }, []);

  return (
    <dialog ref={modalRef} className="please-login-dialog">
      {icon && (
        <img
          src={icon}
          alt=""
          className="dialog-icon"
          style={{ width: "50px", height: "50px" }}
        />
      )}
      <h2>{title}</h2>
      <p>{content}</p>
      <div className="login-buttons">
        <button
          className="login-btn primary"
          onClick={() => modalRef.current?.close()}
        >
          Close
        </button>
      </div>
    </dialog>
  );
});

export default ListingDetailDialog;
